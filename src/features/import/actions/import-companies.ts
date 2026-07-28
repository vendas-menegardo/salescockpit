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
  MAX_CSV_SIZE_LABEL,
} from "../constants";
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

const IMPORT_DATABASE_UPDATE_MESSAGE =
  "A importação está temporariamente indisponível porque uma atualização do sistema ainda não foi concluída. Nenhum dado foi importado. Tente novamente após a atualização.";

function isPendingCompanyBaseMigrationError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  const metadata = JSON.stringify(error.meta ?? {});

  return (
    (error.code === "P2011" && metadata.includes("baseId")) ||
    (error.code === "P2021" && metadata.includes("BaseCompany"))
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

export async function confirmCompaniesImport(input: ImportActionInput) {
  try {
    const parsed = importInputSchema.parse(input);
    const result = await ImportService.confirm(parsed);

    revalidatePath("/bases");
    revalidatePath(`/bases/${result.base.id}`);
    revalidatePath("/empresas");

    return {
      ok: true as const,
      result,
    };
  } catch (error) {
    logUnexpectedError("confirmar o arquivo", error);

    return {
      ok: false as const,
      message: validationMessage(error),
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
