"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { companyContactSchema } from "../validations/company-contact-schema";

export type ContactActionState = {
  error?: string;
  success?: boolean;
};

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
    responsibleName: formData.get("responsibleName") || undefined,
    role: formData.get("role") || undefined,
    source: formData.get("source") || undefined,
    validity: formData.get("validity"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: "Revise os dados do contato e tente novamente." };
  }

  const company = await prisma.company.findUnique({
    where: { id: parsed.data.companyId },
    select: { id: true },
  });
  if (!company) {
    return { error: "A empresa informada não foi encontrada." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (parsed.data.isPrimary) {
        await tx.companyContact.updateMany({
          where: {
            companyId: parsed.data.companyId,
            type: parsed.data.type,
          },
          data: { isPrimary: false },
        });
      }
      await tx.companyContact.create({
        data: {
          ...parsed.data,
          createdByUserId: session.user.id,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Este contato já está cadastrado para a empresa." };
    }
    return { error: "Não foi possível salvar o contato." };
  }

  revalidatePath(`/empresas/${parsed.data.companyId}`);
  return { success: true };
}

export async function updateCompanyContact(formData: FormData) {
  await requireSession();
  const contactId = String(formData.get("contactId") || "");
  const intent = String(formData.get("intent") || "");
  if (!contactId || !["valid", "invalid", "primary"].includes(intent)) return;

  const contact = await prisma.companyContact.findUnique({
    where: { id: contactId },
    select: { id: true, companyId: true, type: true },
  });
  if (!contact) return;

  await prisma.$transaction(async (tx) => {
    if (intent === "primary") {
      await tx.companyContact.updateMany({
        where: { companyId: contact.companyId, type: contact.type },
        data: { isPrimary: false },
      });
      await tx.companyContact.update({
        where: { id: contact.id },
        data: {
          isPrimary: true,
          validity: "VALID",
          validatedAt: new Date(),
        },
      });
      return;
    }

    await tx.companyContact.update({
      where: { id: contact.id },
      data: {
        validity: intent === "valid" ? "VALID" : "INVALID",
        validatedAt: new Date(),
        isPrimary: intent === "invalid" ? false : undefined,
      },
    });
  });

  revalidatePath(`/empresas/${contact.companyId}`);
}
