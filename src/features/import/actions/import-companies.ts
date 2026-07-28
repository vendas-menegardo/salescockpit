"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { BaseService } from "@/features/bases/services/base-service";
import {
  ImportService,
  ImportValidationError,
} from "../services/import-service";
import {
  isCsvTextWithinSizeLimit,
  IMPORT_STAGING_BATCH_SIZE,
  MAX_CSV_SIZE_LABEL,
} from "../constants";
import { isValidCnpj } from "../lib/import-utils";
import type { ImportActionInput } from "../types/import";

const importInputSchema = z.object({
  baseId: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(255),
  csvText: z
    .string()
    .min(1)
    .refine(
      isCsvTextWithinSizeLimit,
      `O CSV deve ter no máximo ${MAX_CSV_SIZE_LABEL}.`
    ),
});

const quickBaseSchema = z.object({
  name: z.string().trim().min(3, "Informe um nome com pelo menos 3 caracteres."),
  description: z.string().trim().max(500).optional(),
});

const importJobSummarySchema = z
  .object({
    totalRows: z.number().int().nonnegative(),
    invalidRows: z.number().int().nonnegative(),
    duplicateRows: z.number().int().nonnegative(),
    emptyRowsIgnored: z.number().int().nonnegative(),
    eligibleRows: z.number().int().nonnegative(),
  })
  .refine(
    (summary) =>
      summary.eligibleRows ===
      summary.totalRows - summary.invalidRows - summary.duplicateRows,
    "Os contadores da prévia não são consistentes."
  );

const startImportJobSchema = z.object({
  jobId: z.string().uuid(),
  baseId: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(255),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/),
  summary: importJobSummarySchema,
});

const companyDataSchema = z.object({
  cnpj: z
    .string()
    .regex(/^\d{14}$/)
    .refine(isValidCnpj, "CNPJ inválido."),
  corporateName: z.string().max(500),
  tradeName: z.string().max(500),
  segment: z.string().max(500),
  city: z.string().max(255),
  state: z.string().max(2),
  phone: z.string().max(100),
  email: z.string().max(320),
  website: z.string().max(2048),
});

const stageImportJobSchema = z.object({
  jobId: z.string().uuid(),
  baseId: z.string().trim().min(1),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/),
  rows: z
    .array(
      z.object({
        rowNumber: z.number().int().min(2),
        data: companyDataSchema,
      })
    )
    .min(1)
    .max(IMPORT_STAGING_BATCH_SIZE),
});

const importJobContextSchema = startImportJobSchema.pick({
  jobId: true,
  baseId: true,
  fileHash: true,
});

const IMPORT_DATABASE_UPDATE_MESSAGE =
  "A importação está temporariamente indisponível porque uma atualização do sistema ainda não foi concluída. Nenhum dado foi importado. Tente novamente após a atualização.";

function isPendingCompanyBaseMigrationError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  const metadata = JSON.stringify(error.meta ?? {});

  return (
    (error.code === "P2011" && metadata.includes("baseId")) ||
    (error.code === "P2021" &&
      (metadata.includes("BaseCompany") ||
        metadata.includes("ImportJob") ||
        metadata.includes("ImportJobRow")))
  );
}

function validationMessage(error: unknown) {
  if (error instanceof ImportValidationError) {
    return error.message;
  }

  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Revise os dados informados.";
  }

  if (isPendingCompanyBaseMigrationError(error)) {
    return IMPORT_DATABASE_UPDATE_MESSAGE;
  }

  return "Não foi possível concluir a operação. Tente novamente.";
}

function logUnexpectedError(operation: string, error: unknown) {
  if (
    error instanceof ImportValidationError ||
    error instanceof z.ZodError
  ) {
    return;
  }

  console.error(`[Importação] Falha ao ${operation}.`, error);
}

export async function analyzeCompaniesImport(input: ImportActionInput) {
  try {
    const parsed = importInputSchema.parse(input);
    const analysis = await ImportService.analyze(parsed);

    return {
      ok: true as const,
      analysis,
    };
  } catch (error) {
    logUnexpectedError("analisar o arquivo", error);

    return {
      ok: false as const,
      message: validationMessage(error),
    };
  }
}

export async function startCompaniesImportJob(input: unknown) {
  try {
    const parsed = startImportJobSchema.parse(input);
    const response = await ImportService.startJob(parsed);

    return {
      ok: true as const,
      ...response,
    };
  } catch (error) {
    logUnexpectedError("iniciar a importação", error);

    return {
      ok: false as const,
      message: validationMessage(error),
    };
  }
}

export async function stageCompaniesImportBatch(input: unknown) {
  try {
    const parsed = stageImportJobSchema.parse(input);
    const progress = await ImportService.stageJobRows(
      {
        jobId: parsed.jobId,
        baseId: parsed.baseId,
        fileHash: parsed.fileHash,
      },
      parsed.rows
    );

    return {
      ok: true as const,
      progress,
    };
  } catch (error) {
    logUnexpectedError("preparar um lote da importação", error);

    return {
      ok: false as const,
      message: validationMessage(error),
    };
  }
}

export async function finalizeCompaniesImportJob(input: unknown) {
  try {
    const context = importJobContextSchema.parse(input);
    const progress = await ImportService.finalizeJob(context);

    return {
      ok: true as const,
      progress,
    };
  } catch (error) {
    logUnexpectedError("finalizar a preparação da importação", error);

    return {
      ok: false as const,
      message: validationMessage(error),
    };
  }
}

export async function processCompaniesImportBatch(input: unknown) {
  try {
    const context = importJobContextSchema.parse(input);
    const response = await ImportService.processJobBatch(context);

    if (response.result) {
      revalidatePath("/bases");
      revalidatePath(`/bases/${response.result.base.id}`);
      revalidatePath("/empresas");
    }

    return {
      ok: true as const,
      ...response,
    };
  } catch (error) {
    logUnexpectedError("processar um lote da importação", error);

    return {
      ok: false as const,
      message:
        error instanceof ImportValidationError ||
        isPendingCompanyBaseMigrationError(error)
          ? validationMessage(error)
          : "O último lote não foi concluído. A importação foi pausada e pode ser retomada com segurança.",
    };
  }
}

export async function createImportBase(input: {
  name: string;
  description?: string;
}) {
  try {
    const parsed = quickBaseSchema.parse(input);
    const base = await BaseService.create(parsed);

    revalidatePath("/bases");
    revalidatePath("/importacao");

    return {
      ok: true as const,
      base: {
        id: base.id,
        name: base.name,
        description: base.description,
      },
    };
  } catch (error) {
    logUnexpectedError("criar a base", error);

    return {
      ok: false as const,
      message: validationMessage(error),
    };
  }
}
