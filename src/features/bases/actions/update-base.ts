"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-session";
import { BaseService } from "../services/base-service";
import {
  createBaseSchema,
  type CreateBaseInput,
} from "../validations/base-schema";

export async function updateBase(
  id: string,
  data: CreateBaseInput
) {
  await requireAdmin();

  const parsed = createBaseSchema.parse(data);

  await BaseService.update(id, parsed);

  revalidatePath("/bases");

  return {
    success: true,
  };
}
