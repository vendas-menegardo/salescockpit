import Papa from "papaparse";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  COMPANY_FIELD_LABELS,
  isDuplicateCnpj,
  isEmptyCsvRow,
  isValidCnpj,
  mapCsvRow,
  mergeCompanyData,
  recognizeHeader,
} from "../lib/import-utils";
import type {
  ImportActionInput,
  ImportAnalysis,
  ImportCompanyData,
  ImportPreviewRow,
  ImportResult,
} from "../types/import";

type ParsedRow = {
  rowNumber: number;
  data: ImportCompanyData;
};

type ParsedCsv = {
  delimiter: "," | ";";
  rows: ParsedRow[];
  emptyRows: number;
};

export class ImportValidationError extends Error {}

function parseCsv({ fileName, csvText }: Pick<ImportActionInput, "fileName" | "csvText">) {
  if (!fileName.toLowerCase().endsWith(".csv")) {
    throw new ImportValidationError("Selecione um arquivo com extensão .csv.");
  }

  if (!csvText.trim()) {
    throw new ImportValidationError("O arquivo CSV está vazio.");
  }

  const parsed = Papa.parse<Record<string, string | undefined>>(csvText, {
    header: true,
    skipEmptyLines: false,
    transformHeader: (header) => header.trim(),
  });

  const fields = parsed.meta.fields ?? [];
  const hasCnpjColumn = fields.some(
    (field) => recognizeHeader(field) === "cnpj"
  );

  if (!hasCnpjColumn) {
    throw new ImportValidationError(
      "O CSV precisa conter uma coluna de CNPJ reconhecida."
    );
  }

  const fatalError = parsed.errors.find((error) => error.type === "Quotes");

  if (fatalError) {
    throw new ImportValidationError(
      "O CSV possui aspas ou colunas malformadas e não pôde ser lido com segurança."
    );
  }

  const delimiter = parsed.meta.delimiter;

  if (delimiter !== "," && delimiter !== ";") {
    throw new ImportValidationError(
      "Use vírgula ou ponto e vírgula como delimitador do CSV."
    );
  }

  let emptyRows = 0;
  const rows: ParsedRow[] = [];

  parsed.data.forEach((row, index) => {
    if (isEmptyCsvRow(row)) {
      emptyRows++;
      return;
    }

    rows.push({
      rowNumber: index + 2,
      data: mapCsvRow(row),
    });
  });

  if (rows.length === 0) {
    throw new ImportValidationError("O CSV não contém registros para importar.");
  }

  return {
    delimiter,
    rows,
    emptyRows,
  } satisfies ParsedCsv;
}

function companyFields(data: ImportCompanyData) {
  return {
    corporateName: data.corporateName,
    tradeName: data.tradeName,
    segment: data.segment,
    city: data.city,
    state: data.state,
    phone: data.phone,
    email: data.email,
    website: data.website,
  };
}

function conflictLabels(conflicts: ReturnType<typeof mergeCompanyData>["conflicts"]) {
  return conflicts.map((field) => COMPANY_FIELD_LABELS[field]);
}

export class ImportService {
  static async analyze(input: ImportActionInput): Promise<ImportAnalysis> {
    const parsed = parseCsv(input);
    const base = await prisma.base.findUnique({
      where: { id: input.baseId },
      select: { id: true, name: true },
    });

    if (!base) {
      throw new ImportValidationError("A base de destino não foi encontrada.");
    }

    const validCnpjs = Array.from(
      new Set(
        parsed.rows
          .map((row) => row.data.cnpj)
          .filter((cnpj) => isValidCnpj(cnpj))
      )
    );

    const existingCompanies = await prisma.company.findMany({
      where: {
        cnpj: {
          in: validCnpjs,
        },
      },
      include: {
        bases: {
          select: {
            baseId: true,
          },
        },
      },
    });
    const companiesByCnpj = new Map(
      existingCompanies
        .filter((company) => company.cnpj)
        .map((company) => [company.cnpj as string, company])
    );

    const seenCnpjs = new Set<string>();
    const previewRows: ImportPreviewRow[] = [];
    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;
    let newCompanies = 0;
    let existingCount = 0;
    let alreadyInBase = 0;
    let conflictsCount = 0;

    for (const row of parsed.rows) {
      const { cnpj } = row.data;

      if (!cnpj) {
        invalidRows++;
        previewRows.push({
          ...row,
          status: "invalid",
          detail: "CNPJ ausente.",
          eligible: false,
          conflicts: [],
        });
        continue;
      }

      if (!isValidCnpj(cnpj)) {
        invalidRows++;
        previewRows.push({
          ...row,
          status: "invalid",
          detail: "CNPJ com formato ou dígitos verificadores inválidos.",
          eligible: false,
          conflicts: [],
        });
        continue;
      }

      validRows++;

      if (isDuplicateCnpj(cnpj, seenCnpjs)) {
        duplicateRows++;
        previewRows.push({
          ...row,
          status: "duplicate_file",
          detail: "CNPJ repetido dentro do próprio arquivo.",
          eligible: false,
          conflicts: [],
        });
        continue;
      }

      const existing = companiesByCnpj.get(cnpj);

      if (!existing) {
        newCompanies++;
        previewRows.push({
          ...row,
          status: "new_company",
          detail: "Nova empresa e novo vínculo com a base.",
          eligible: true,
          conflicts: [],
        });
        continue;
      }

      existingCount++;
      const membershipExists = existing.bases.some(
        (membership) => membership.baseId === base.id
      );
      const merge = mergeCompanyData(existing, companyFields(row.data));
      const conflicts = conflictLabels(merge.conflicts);
      const filledFields = conflictLabels(merge.filledFields);

      if (membershipExists) {
        alreadyInBase++;
      }

      if (conflicts.length > 0) {
        conflictsCount++;
        previewRows.push({
          ...row,
          status: "conflict",
          detail: membershipExists
            ? "Empresa já presente na base; valores existentes serão preservados."
            : "Empresa existente; será vinculada sem substituir valores diferentes.",
          eligible: true,
          conflicts,
        });
        continue;
      }

      previewRows.push({
        ...row,
        status: membershipExists ? "already_in_base" : "existing_new_link",
        detail: membershipExists
          ? filledFields.length > 0
            ? `Já presente na base; campos vazios serão preenchidos: ${filledFields.join(", ")}.`
            : "Empresa e vínculo já existentes; nenhuma duplicação será criada."
          : filledFields.length > 0
            ? `Novo vínculo; campos vazios serão preenchidos: ${filledFields.join(", ")}.`
            : "Cadastro existente; será criado somente o vínculo com a base.",
        eligible: true,
        conflicts: [],
      });
    }

    return {
      fileName: input.fileName,
      delimiter: parsed.delimiter,
      base,
      summary: {
        totalRows: parsed.rows.length,
        validRows,
        invalidRows,
        duplicateRows,
        emptyRowsIgnored: parsed.emptyRows,
        eligibleRows: validRows - duplicateRows,
        newCompanies,
        existingCompanies: existingCount,
        alreadyInBase,
        conflicts: conflictsCount,
      },
      rows: previewRows,
    };
  }

  static async confirm(input: ImportActionInput): Promise<ImportResult> {
    const parsed = parseCsv(input);

    const execute = () =>
      prisma.$transaction(
        async (tx) => {
          const base = await tx.base.findUnique({
            where: { id: input.baseId },
            select: { id: true, name: true },
          });

          if (!base) {
            throw new ImportValidationError("A base de destino não foi encontrada.");
          }

          const seenCnpjs = new Set<string>();
          let companiesCreated = 0;
          let existingCompaniesReused = 0;
          let linksCreated = 0;
          let alreadyInBase = 0;
          let invalidIgnored = 0;
          let duplicatesIgnored = 0;
          let conflictsPreserved = 0;

          for (const row of parsed.rows) {
            const { cnpj } = row.data;

            if (!cnpj || !isValidCnpj(cnpj)) {
              invalidIgnored++;
              continue;
            }

            if (isDuplicateCnpj(cnpj, seenCnpjs)) {
              duplicatesIgnored++;
              continue;
            }

            let companyWasCreated = false;
            let company = await tx.company.findUnique({
              where: { cnpj },
            });

            if (company) {
              const merge = mergeCompanyData(company, companyFields(row.data));

              if (merge.conflicts.length > 0) {
                conflictsPreserved++;
              }

              if (Object.keys(merge.updates).length > 0) {
                company = await tx.company.update({
                  where: { id: company.id },
                  data: merge.updates,
                });
              }
            } else {
              company = await tx.company.create({
                data: {
                  cnpj,
                  corporateName:
                    row.data.corporateName ||
                    row.data.tradeName ||
                    "Empresa sem razão social",
                  tradeName: row.data.tradeName || null,
                  segment: row.data.segment || null,
                  city: row.data.city || null,
                  state: row.data.state || null,
                  phone: row.data.phone || null,
                  email: row.data.email || null,
                  website: row.data.website || null,
                },
              });
              companiesCreated++;
              companyWasCreated = true;
            }

            const membership = await tx.baseCompany.findUnique({
              where: {
                baseId_companyId: {
                  baseId: base.id,
                  companyId: company.id,
                },
              },
            });

            if (membership) {
              alreadyInBase++;
            } else {
              await tx.baseCompany.create({
                data: {
                  baseId: base.id,
                  companyId: company.id,
                },
              });
              linksCreated++;

              if (!companyWasCreated) {
                existingCompaniesReused++;
              }
            }
          }

          const companiesCount = await tx.baseCompany.count({
            where: { baseId: base.id },
          });

          await tx.base.update({
            where: { id: base.id },
            data: { companiesCount },
          });

          return {
            base,
            companiesCreated,
            existingCompaniesReused,
            linksCreated,
            alreadyInBase,
            invalidIgnored,
            duplicatesIgnored,
            emptyRowsIgnored: parsed.emptyRows,
            conflictsPreserved,
            failures: 0,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 20_000,
        }
      );

    try {
      return await execute();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034")
      ) {
        return execute();
      }

      throw error;
    }
  }
}
