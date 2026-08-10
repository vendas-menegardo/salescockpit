"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { calculateCompanyCompleteness } from "../lib/company-completeness";
import {
  companyProfileSchema,
  quickCompanyProfileSchema,
} from "../validations/company-profile-schema";

export type CompanyProfileActionState = {
  error?: string;
  success?: boolean;
};

export async function updateCompanyProfile(
  _previousState: CompanyProfileActionState,
  formData: FormData
): Promise<CompanyProfileActionState> {
  const session = await requireSession();
  const parsed = companyProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Revise os dados do dossiê e tente novamente." };
  }

  const { companyId, ...data } = parsed.data;
  const existing = await prisma.company.findUnique({
    where: { id: companyId },
    include: { _count: { select: { contacts: true } } },
  });
  if (!existing) return { error: "Empresa não encontrada." };

  const changedFields = Object.fromEntries(
    Object.entries(data)
      .filter(([field, value]) => existing[field as keyof typeof data] !== value)
      .map(([field, value]) => [
        field,
        {
          before: existing[field as keyof typeof data] ?? null,
          after: value,
        },
      ])
  );
  if (Object.keys(changedFields).length === 0) return { success: true };

  const before = calculateCompanyCompleteness({
    ...existing,
    contactCount: existing._count.contacts,
  });
  const after = calculateCompanyCompleteness({
    ...existing,
    ...data,
    contactCount: existing._count.contacts,
  });

  try {
    await prisma.$transaction([
      prisma.company.update({ where: { id: companyId }, data }),
      prisma.companyDataChange.create({
        data: {
          companyId,
          userId: session.user.id,
          changedFields,
          completenessBefore: before,
          completenessAfter: after,
        },
      }),
    ]);
  } catch {
    return { error: "Não foi possível atualizar o dossiê." };
  }

  revalidatePath(`/empresas/${companyId}`);
  revalidatePath("/empresas");
  revalidatePath("/");
  revalidatePath("/relatorios");
  return { success: true };
}

export async function updateQuickCompanyProfile(
  _previousState: CompanyProfileActionState,
  formData: FormData
): Promise<CompanyProfileActionState> {
  const session = await requireSession();
  const parsed = quickCompanyProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Revise os dados informados." };

  const { companyId, ...data } = parsed.data;
  const existing = await prisma.company.findUnique({
    where: { id: companyId },
    include: { _count: { select: { contacts: true } } },
  });
  if (!existing) return { error: "Empresa não encontrada." };

  const changedFields = Object.fromEntries(
    Object.entries(data)
      .filter(([field, value]) => existing[field as keyof typeof data] !== value)
      .map(([field, value]) => [
        field,
        { before: existing[field as keyof typeof data] ?? null, after: value },
      ])
  );
  if (Object.keys(changedFields).length === 0) return { success: true };

  const completenessBefore = calculateCompanyCompleteness({
    ...existing,
    contactCount: existing._count.contacts,
  });
  const completenessAfter = calculateCompanyCompleteness({
    ...existing,
    ...data,
    contactCount: existing._count.contacts,
  });

  try {
    await prisma.$transaction([
      prisma.company.update({ where: { id: companyId }, data }),
      prisma.companyDataChange.create({
        data: {
          companyId,
          userId: session.user.id,
          changedFields,
          completenessBefore,
          completenessAfter,
        },
      }),
    ]);
  } catch {
    return { error: "Não foi possível atualizar os dados operacionais." };
  }

  revalidatePath("/operacao");
  revalidatePath(`/empresas/${companyId}`);
  revalidatePath("/empresas");
  return { success: true };
}
