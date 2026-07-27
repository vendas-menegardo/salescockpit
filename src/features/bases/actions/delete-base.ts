"use server";

import { revalidatePath } from "next/cache";
import { BaseService } from "../services/base-service";

export async function deleteBase(id: string) {
  await BaseService.delete(id);

  revalidatePath("/bases");
}
