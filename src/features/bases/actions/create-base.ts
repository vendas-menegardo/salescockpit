"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-session";
import { BaseService } from "../services/base-service";
import {
  createBaseSchema,
  type CreateBaseInput,
} from "../validations/base-schema";

export async function createBase(data: CreateBaseInput) {
  await requireAdmin();

  const parsed = createBaseSchema.parse(data);

  await BaseService.create(parsed);

  revalidatePath("/bases");

  return {
    success: true,
  };
}
