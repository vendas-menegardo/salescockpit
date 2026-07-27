"use server";

import { revalidatePath } from "next/cache";
import { BaseService } from "../services/base-service";

export async function setActiveBase(id: string) {
  await BaseService.activate(id);

  revalidatePath("/bases");
}