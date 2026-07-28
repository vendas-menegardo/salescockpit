"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-session";
import { BaseService } from "../services/base-service";

export async function setActiveBase(id: string) {
  await requireAdmin();

  await BaseService.activate(id);

  revalidatePath("/bases");
}
