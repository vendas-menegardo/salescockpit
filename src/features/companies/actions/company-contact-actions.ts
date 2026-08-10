"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth-session";
import { CompanyContactService } from "../services/company-contact-service";
import {
  companyContactSchema,
  editCompanyContactSchema,
} from "../validations/company-contact-schema";

export type ContactActionState = {
  error?: string;
  success?: boolean;
};

function revalidateCompanyContactPaths(companyId: string) {
  revalidatePath(`/empresas/${companyId}`);
  revalidatePath("/empresas");
  revalidatePath("/operacao");
  revalidatePath("/");
  revalidatePath("/relatorios");
}

export async function addCompanyContact(
  _previousState: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  const session = await requireSession();
  const parsed = companyContactSchema.safeParse({
    companyId: formData.get("companyId"),
    type: formData.get("type"),
    value: formData.get("value"),
    isPrimary: formData.get("isPrimary") === "on",
    isWhatsapp: formData.get("isWhatsapp") === "on",
    responsibleName: formData.get("responsibleName") || undefined,
    role: formData.get("role") || undefined,
    source: formData.get("source") || undefined,
    validity: formData.get("validity"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: "Revise os dados do contato e tente novamente." };
  }

  try {
    await CompanyContactService.create({
      ...parsed.data,
      userId: session.user.id,
    });
  } catch (error) {
    if (
      (error instanceof Error && error.message === "DUPLICATE_CONTACT") ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002")
    ) {
      return { error: "Este contato já está cadastrado para a empresa." };
    }
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
      return { error: "A empresa informada não foi encontrada." };
    }
    if (error instanceof Error && error.message === "INVALID_CONTACT_VALUE") {
      return { error: "Informe um contato válido." };
    }
    return { error: "Não foi possível salvar o contato." };
  }

  revalidateCompanyContactPaths(parsed.data.companyId);
  return { success: true };
}

const contactIntents = [
  "valid",
  "primary",
  "whatsapp",
  "not_whatsapp",
  "invalid_wrong",
  "invalid_nonexistent",
  "invalid_email",
  "archive",
  "restore",
] as const;

export async function updateCompanyContact(formData: FormData) {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") || "");
  const intent = String(formData.get("intent") || "");
  if (
    !contactId ||
    !contactIntents.includes(intent as (typeof contactIntents)[number])
  ) {
    return;
  }

  try {
    const result = await CompanyContactService.applyIntent({
      contactId,
      userId: session.user.id,
      intent: intent as (typeof contactIntents)[number],
      reason: String(formData.get("reason") || "").trim() || undefined,
    });
    revalidateCompanyContactPaths(result.contact.companyId);
  } catch {
    return;
  }
}

export async function editCompanyContact(
  _previousState: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  const session = await requireSession();
  const parsed = editCompanyContactSchema.safeParse({
    contactId: formData.get("contactId"),
    value: formData.get("value"),
    isWhatsapp: formData.get("isWhatsapp") === "on",
    responsibleName: formData.get("responsibleName") || undefined,
    role: formData.get("role") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: "Revise os dados do contato." };

  try {
    const updated = await CompanyContactService.update(parsed.data.contactId, {
      value: parsed.data.value,
      isWhatsapp: parsed.data.isWhatsapp,
      responsibleName: parsed.data.responsibleName,
      role: parsed.data.role,
      notes: parsed.data.notes,
      userId: session.user.id,
    });
    revalidateCompanyContactPaths(updated.companyId);
    return { success: true };
  } catch (error) {
    if (
      (error instanceof Error && error.message === "DUPLICATE_CONTACT") ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002")
    ) {
      return { error: "Este contato já está cadastrado para a empresa." };
    }
    if (error instanceof Error && error.message === "INVALID_CONTACT_VALUE") {
      return { error: "Informe um contato válido." };
    }
    return { error: "Não foi possível atualizar o contato." };
  }
}
