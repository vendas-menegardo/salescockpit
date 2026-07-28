import Papa from "papaparse";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  IMPORT_LOOKUP_BATCH_SIZE,
  IMPORT_PROCESS_BATCH_SIZE,
} from "../constants";
import {
  addImportBatchCounters,
  chunkItems,
  matchesImportJobIdentity,
  summarizeMembershipBatch,
} from "../lib/import-batching";
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
  ImportJobContext,
  ImportJobProgress,
  ImportJobStageRow,
  ImportPreviewRow,
  ImportResult,
  StartImportJobInput,
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

type ImportJobWithBase = Prisma.ImportJobGetPayload<{
  include: { base: { select: { id: true; name: true } } };
}>;

function jobProgress(job: {
  id: string;
  status: string;
  stagedRows: number;
  processedRows: number;
  eligibleRows: number;
}): ImportJobProgress {
  return {
    jobId: job.id,
    status: job.status,
    stagedRows: job.stagedRows,
    processedRows: job.processedRows,
    eligibleRows: job.eligibleRows,
  };
}

function jobResult(job: ImportJobWithBase): ImportResult {
  return {
    base: job.base,
    companiesCreated: job.companiesCreated,
    existingCompaniesReused: job.existingCompaniesReused,
    linksCreated: job.linksCreated,
    alreadyInBase: job.alreadyInBase,
    invalidIgnored: job.invalidIgnored,
    duplicatesIgnored: job.duplicatesIgnored,
    emptyRowsIgnored: job.emptyRowsIgnored,
    conflictsPreserved: job.conflictsPreserved,
    failures: job.failures,
  };
}

async function lockImportJob(tx: Prisma.TransactionClient, jobId: string) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "public"."ImportJob" WHERE "id" = ${jobId} FOR UPDATE`
  );
}

function assertImportJobIdentity(
  job: { baseId: string; fileHash: string },
  context: ImportJobContext
) {
  if (!matchesImportJobIdentity(job, context)) {
    throw new ImportValidationError(
      "Esta importação pertence a outra base ou a outro arquivo."
    );
  }
}

async function fillEmptyCompanyFields(
  tx: Prisma.TransactionClient,
  updates: Array<{ id: string; data: ImportCompanyData }>
) {
  if (updates.length === 0) {
    return;
  }

  const values = updates.map(({ id, data }) =>
    Prisma.sql`(
      ${id},
      ${data.corporateName},
      ${data.tradeName},
      ${data.segment},
      ${data.city},
      ${data.state},
      ${data.phone},
      ${data.email},
      ${data.website}
    )`
  );

  await tx.$executeRaw(
    Prisma.sql`
      UPDATE "public"."Company" AS company
      SET
        "corporateName" = CASE
          WHEN BTRIM(company."corporateName") = '' AND incoming."corporateName" <> ''
            THEN incoming."corporateName"
          ELSE company."corporateName"
        END,
        "tradeName" = CASE
          WHEN BTRIM(COALESCE(company."tradeName", '')) = '' AND incoming."tradeName" <> ''
            THEN incoming."tradeName"
          ELSE company."tradeName"
        END,
        "segment" = CASE
          WHEN BTRIM(COALESCE(company."segment", '')) = '' AND incoming."segment" <> ''
            THEN incoming."segment"
          ELSE company."segment"
        END,
        "city" = CASE
          WHEN BTRIM(COALESCE(company."city", '')) = '' AND incoming."city" <> ''
            THEN incoming."city"
          ELSE company."city"
        END,
        "state" = CASE
          WHEN BTRIM(COALESCE(company."state", '')) = '' AND incoming."state" <> ''
            THEN incoming."state"
          ELSE company."state"
        END,
        "phone" = CASE
          WHEN BTRIM(COALESCE(company."phone", '')) = '' AND incoming."phone" <> ''
            THEN incoming."phone"
          ELSE company."phone"
        END,
        "email" = CASE
          WHEN BTRIM(COALESCE(company."email", '')) = '' AND incoming."email" <> ''
            THEN incoming."email"
          ELSE company."email"
        END,
        "website" = CASE
          WHEN BTRIM(COALESCE(company."website", '')) = '' AND incoming."website" <> ''
            THEN incoming."website"
          ELSE company."website"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
      FROM (
        VALUES ${Prisma.join(values)}
      ) AS incoming(
        "id",
        "corporateName",
        "tradeName",
        "segment",
        "city",
        "state",
        "phone",
        "email",
        "website"
      )
      WHERE company."id" = incoming."id"
    `
  );
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

    const existingCompanies = [];

    for (const cnpjBatch of chunkItems(validCnpjs, IMPORT_LOOKUP_BATCH_SIZE)) {
      const companies = await prisma.company.findMany({
        where: {
          cnpj: {
            in: cnpjBatch,
          },
        },
        include: {
          bases: {
            where: {
              baseId: base.id,
            },
            select: {
              baseId: true,
            },
          },
        },
      });

      existingCompanies.push(...companies);
    }
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

  static async startJob(input: StartImportJobInput) {
    const base = await prisma.base.findUnique({
      where: { id: input.baseId },
      select: { id: true },
    });

    if (!base) {
      throw new ImportValidationError("A base de destino não foi encontrada.");
    }

    const job = await prisma.importJob.upsert({
      where: { id: input.jobId },
      update: {},
      create: {
        id: input.jobId,
        baseId: input.baseId,
        fileName: input.fileName,
        fileHash: input.fileHash,
        totalRows: input.summary.totalRows,
        eligibleRows: input.summary.eligibleRows,
        invalidIgnored: input.summary.invalidRows,
        duplicatesIgnored: input.summary.duplicateRows,
        emptyRowsIgnored: input.summary.emptyRowsIgnored,
      },
      include: {
        base: {
          select: { id: true, name: true },
        },
      },
    });

    if (
      job.baseId !== input.baseId ||
      job.fileName !== input.fileName ||
      job.fileHash !== input.fileHash ||
      job.totalRows !== input.summary.totalRows ||
      job.eligibleRows !== input.summary.eligibleRows ||
      job.invalidIgnored !== input.summary.invalidRows ||
      job.duplicatesIgnored !== input.summary.duplicateRows ||
      job.emptyRowsIgnored !== input.summary.emptyRowsIgnored
    ) {
      throw new ImportValidationError(
        "Não foi possível retomar esta importação com um arquivo diferente."
      );
    }

    return {
      progress: jobProgress(job),
      result: job.status === "COMPLETED" ? jobResult(job) : null,
    };
  }

  static async stageJobRows(
    context: ImportJobContext,
    rows: ImportJobStageRow[]
  ) {
    return prisma.$transaction(
      async (tx) => {
        await lockImportJob(tx, context.jobId);

        const job = await tx.importJob.findUnique({
          where: { id: context.jobId },
        });

        if (!job) {
          throw new ImportValidationError("A importação não foi encontrada.");
        }

        assertImportJobIdentity(job, context);

        if (job.status === "COMPLETED") {
          return jobProgress(job);
        }

        const inserted = await tx.importJobRow.createMany({
          data: rows.map((row) => ({
            jobId: context.jobId,
            rowNumber: row.rowNumber,
            ...row.data,
          })),
          skipDuplicates: true,
        });

        const updated = await tx.importJob.update({
          where: { id: context.jobId },
          data: {
            stagedRows: { increment: inserted.count },
            status: inserted.count > 0 ? "PREPARING" : job.status,
            lastError: null,
          },
        });

        if (updated.stagedRows > updated.eligibleRows) {
          throw new ImportValidationError(
            "A quantidade de linhas preparadas excede a prévia validada."
          );
        }

        return jobProgress(updated);
      },
      { maxWait: 5_000, timeout: 20_000 }
    );
  }

  static async finalizeJob(context: ImportJobContext) {
    return prisma.$transaction(
      async (tx) => {
        await lockImportJob(tx, context.jobId);

        const job = await tx.importJob.findUnique({
          where: { id: context.jobId },
        });

        if (!job) {
          throw new ImportValidationError("A importação não foi encontrada.");
        }

        assertImportJobIdentity(job, context);

        if (job.status === "COMPLETED") {
          return jobProgress(job);
        }

        const stagedRows = await tx.importJobRow.count({
          where: { jobId: context.jobId },
        });

        if (stagedRows !== job.eligibleRows) {
          throw new ImportValidationError(
            `A preparação recebeu ${stagedRows} de ${job.eligibleRows} linhas elegíveis. Tente retomar a importação.`
          );
        }

        const updated = await tx.importJob.update({
          where: { id: context.jobId },
          data: {
            stagedRows,
            status: "READY",
            lastError: null,
          },
        });

        return jobProgress(updated);
      },
      { maxWait: 5_000, timeout: 20_000 }
    );
  }

  static async processJobBatch(context: ImportJobContext) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await lockImportJob(tx, context.jobId);

          const job = await tx.importJob.findUnique({
            where: { id: context.jobId },
            include: {
              base: {
                select: { id: true, name: true },
              },
            },
          });

          if (!job) {
            throw new ImportValidationError("A importação não foi encontrada.");
          }

          assertImportJobIdentity(job, context);

          if (job.status === "COMPLETED") {
            return {
              progress: jobProgress(job),
              result: jobResult(job),
            };
          }

          if (job.status === "PREPARING") {
            throw new ImportValidationError(
              "A importação ainda está preparando os lotes."
            );
          }

          await tx.$queryRaw(
            Prisma.sql`
              SELECT "id"
              FROM "public"."Base"
              WHERE "id" = ${job.baseId}
              FOR UPDATE
            `
          );

          const rows = await tx.importJobRow.findMany({
            where: { jobId: context.jobId, processedAt: null },
            orderBy: { rowNumber: "asc" },
            take: IMPORT_PROCESS_BATCH_SIZE,
          });

          if (rows.length === 0) {
            throw new ImportValidationError(
              "A importação não possui um próximo lote consistente para processar."
            );
          }

          const cnpjs = rows.map((row) => row.cnpj);
          const existingBefore = await tx.company.findMany({
            where: { cnpj: { in: cnpjs } },
            select: { cnpj: true },
          });
          const existingCnpjs = new Set(
            existingBefore.flatMap((company) =>
              company.cnpj ? [company.cnpj] : []
            )
          );
          const newRows = rows
            .filter((row) => !existingCnpjs.has(row.cnpj))
            .sort((left, right) => left.cnpj.localeCompare(right.cnpj));
          const createdCompanies =
            newRows.length === 0
              ? []
              : await tx.company.createManyAndReturn({
                  data: newRows.map((row) => ({
                    cnpj: row.cnpj,
                    corporateName:
                      row.corporateName ||
                      row.tradeName ||
                      "Empresa sem razão social",
                    tradeName: row.tradeName || null,
                    segment: row.segment || null,
                    city: row.city || null,
                    state: row.state || null,
                    phone: row.phone || null,
                    email: row.email || null,
                    website: row.website || null,
                  })),
                  skipDuplicates: true,
                  select: { id: true, cnpj: true },
                });

          const companiesToLock = await tx.company.findMany({
            where: { cnpj: { in: cnpjs } },
            select: { id: true },
          });
          const companyIds = companiesToLock
            .map((company) => company.id)
            .sort();

          await tx.$queryRaw(
            Prisma.sql`
              SELECT "id"
              FROM "public"."Company"
              WHERE "id" IN (${Prisma.join(companyIds)})
              ORDER BY "id"
              FOR UPDATE
            `
          );

          const companies = await tx.company.findMany({
            where: { id: { in: companyIds } },
          });

          if (companies.length !== rows.length) {
            throw new Error("Nem todas as empresas do lote foram localizadas.");
          }

          const rowsByCnpj = new Map(rows.map((row) => [row.cnpj, row]));
          const createdCompanyIds = new Set(
            createdCompanies.map((company) => company.id)
          );
          let conflictsPreserved = 0;
          const fieldUpdates: Array<{
            id: string;
            data: ImportCompanyData;
          }> = [];

          for (const company of companies) {
            const row = company.cnpj ? rowsByCnpj.get(company.cnpj) : undefined;

            if (!row || createdCompanyIds.has(company.id)) {
              continue;
            }

            const data = companyFields(row);
            const merge = mergeCompanyData(company, data);

            if (merge.conflicts.length > 0) {
              conflictsPreserved++;
            }

            if (Object.keys(merge.updates).length > 0) {
              fieldUpdates.push({ id: company.id, data: row });
            }
          }

          await fillEmptyCompanyFields(tx, fieldUpdates);

          const createdMemberships =
            companies.length === 0
              ? []
              : await tx.baseCompany.createManyAndReturn({
                  data: companies.map((company) => ({
                    baseId: job.baseId,
                    companyId: company.id,
                  })),
                  skipDuplicates: true,
                  select: { companyId: true },
                });
          const membershipSummary = summarizeMembershipBatch(
            companies.map((company) => company.id),
            createdCompanyIds,
            createdMemberships.map((membership) => membership.companyId)
          );

          const processed = await tx.importJobRow.updateMany({
            where: {
              jobId: context.jobId,
              rowNumber: { in: rows.map((row) => row.rowNumber) },
              processedAt: null,
            },
            data: { processedAt: new Date() },
          });

          if (processed.count !== rows.length) {
            throw new Error("O lote mudou durante o processamento.");
          }

          const nextCounters = addImportBatchCounters(
            {
              processedRows: job.processedRows,
              companiesCreated: job.companiesCreated,
              existingCompaniesReused: job.existingCompaniesReused,
              linksCreated: job.linksCreated,
              alreadyInBase: job.alreadyInBase,
              conflictsPreserved: job.conflictsPreserved,
            },
            {
              processedRows: processed.count,
              companiesCreated: createdCompanies.length,
              existingCompaniesReused:
                membershipSummary.existingCompaniesReused,
              linksCreated: membershipSummary.linksCreated,
              alreadyInBase: membershipSummary.alreadyInBase,
              conflictsPreserved,
            }
          );
          const completed = nextCounters.processedRows === job.eligibleRows;

          if (nextCounters.processedRows > job.eligibleRows) {
            throw new Error("O progresso excedeu a quantidade de linhas elegíveis.");
          }

          const companiesCount = await tx.baseCompany.count({
            where: { baseId: job.baseId },
          });

          await tx.base.update({
            where: { id: job.baseId },
            data: { companiesCount },
          });

          const updated = await tx.importJob.update({
            where: { id: context.jobId },
            data: {
              status: completed ? "COMPLETED" : "PROCESSING",
              ...nextCounters,
              lastError: null,
            },
            include: {
              base: {
                select: { id: true, name: true },
              },
            },
          });

          return {
            progress: jobProgress(updated),
            result: completed ? jobResult(updated) : null,
          };
        },
        { maxWait: 5_000, timeout: 20_000 }
      );
    } catch (error) {
      await prisma.importJob
        .updateMany({
          where: {
            id: context.jobId,
            baseId: context.baseId,
            fileHash: context.fileHash,
            status: { not: "COMPLETED" },
          },
          data: {
            status: "PAUSED",
            lastError:
              "O último lote não foi concluído e pode ser retomado com segurança.",
          },
        })
        .catch(() => undefined);

      throw error;
    }
  }
}
