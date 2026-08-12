"use server";

import { ContactType, ContactValidity, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { CompanyContactService } from "@/features/companies/services/company-contact-service";
import { companyContactSchema } from "@/features/companies/validations/company-contact-schema";
import { requireSession } from "@/lib/auth-session";
import { EnrichmentService } from "../services/enrichment-service";

export type EnrichmentActionState = { success?: string; error?: string };

function refresh() {
  revalidatePath("/enriquecimento");
  revalidatePath("/empresas");
  revalidatePath("/operacao");
  revalidatePath("/");
}

export async function addEnrichmentCandidate(_state: EnrichmentActionState, formData: FormData): Promise<EnrichmentActionState> {
  const session = await requireSession();
  const parsed = companyContactSchema.safeParse({
    companyId: formData.get("companyId"),
    type: formData.get("type"),
    value: formData.get("value"),
    isPrimary: false,
    isWhatsapp: formData.get("isWhatsapp") === "on",
    responsibleName: formData.get("responsibleName") || undefined,
    role: formData.get("role") || undefined,
    source: formData.get("source") || undefined,
    validity: ContactValidity.UNKNOWN,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success || !parsed.data.source || parsed.data.source.length < 2) {
    return { error: "Informe o contato e a fonte consultada." };
  }
  try {
    await CompanyContactService.create({
      ...parsed.data,
      isPrimary: false,
      isWhatsapp: parsed.data.isWhatsapp || parsed.data.type === ContactType.WHATSAPP,
      validity: ContactValidity.UNKNOWN,
      userId: session.user.id,
    });
    refresh();
    return { success: "Candidato adicionado para revisão." };
  } catch (error) {
    if ((error instanceof Error && error.message === "DUPLICATE_CONTACT") || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      return { error: "Este contato já está cadastrado para a empresa." };
    }
    if (error instanceof Error && error.message === "INVALID_CONTACT_VALUE") return { error: "Informe um contato válido." };
    return { error: "Não foi possível adicionar o candidato." };
  }
}

export async function reviewEnrichmentCandidate(_state: EnrichmentActionState, formData: FormData): Promise<EnrichmentActionState> {
  const session = await requireSession();
  const contactId = String(formData.get("contactId") || "");
  const decision = String(formData.get("decision") || "");
  if (!contactId || !["accept", "reject", "primary"].includes(decision)) return { error: "Ação inválida." };
  try {
    await CompanyContactService.applyIntent({
      contactId,
      userId: session.user.id,
      intent: decision === "accept" ? "valid" : decision === "primary" ? "primary" : "invalid_other",
      reason: decision === "reject" ? "Candidato rejeitado na central de enriquecimento" : "Revisado na central de enriquecimento",
    });
    refresh();
    return { success: decision === "reject" ? "Candidato rejeitado." : "Contato validado." };
  } catch {
    return { error: "Não foi possível revisar este contato." };
  }
}

export async function completeEnrichment(_state: EnrichmentActionState, formData: FormData): Promise<EnrichmentActionState> {
  const session = await requireSession();
  const companyId = String(formData.get("companyId") || "");
  const baseId = String(formData.get("baseId") || "");
  if (!companyId || !baseId) return { error: "Empresa ou base inválida." };
  try {
    await EnrichmentService.completeContactUpdate({ companyId, baseId, userId: session.user.id });
    refresh();
    return { success: "Atualização concluída. A empresa voltou para a operação." };
  } catch (error) {
    if (error instanceof Error && error.message === "VALID_CONTACT_REQUIRED") return { error: "Valide ao menos um telefone, WhatsApp ou e-mail antes de concluir." };
    if (error instanceof Error && error.message === "ALREADY_COMPLETED") return { error: "Esta atualização já foi concluída." };
    return { error: "Não foi possível concluir a atualização." };
  }
}
