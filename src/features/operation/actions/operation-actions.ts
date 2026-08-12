"use server";

import { randomUUID } from "node:crypto";
import { refresh, revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth-session";
import { isOperationView } from "../constants";
import { OperationService } from "../services/operation-service";
import {
  communicationEventSchema,
  correctInteractionSchema,
  saveInteractionSchema,
  updateQualificationSchema,
} from "../validations/operation-schema";

export type OperationActionState = {
  error?: string;
  success?: boolean;
};

export type CommunicationActionState = OperationActionState & {
  interactionId?: string;
};

export async function updateCompanyQualification(formData: FormData) {
  const session = await requireSession();
  const parsed = updateQualificationSchema.safeParse({
    baseId: formData.get("baseId"),
    companyId: formData.get("companyId"),
    qualification: formData.get("qualification"),
    reason:
      formData.get("qualificationReason") ||
      formData.get("reason") ||
      undefined,
  });
  if (!parsed.success) return;
  await OperationService.updateQualification({
    ...parsed.data,
    userId: session.user.id,
  });
  revalidatePath("/operacao");
  revalidatePath(`/empresas/${parsed.data.companyId}`);
  revalidatePath("/empresas");
  revalidatePath("/enriquecimento");
  revalidatePath("/");
}

export async function recordCommunicationEvent(
  input: unknown
): Promise<CommunicationActionState> {
  const session = await requireSession();
  const parsed = communicationEventSchema.safeParse(input);
  if (!parsed.success) return { error: "Revise os dados da comunicação." };
  try {
    const interaction = await OperationService.recordCommunication({
      ...parsed.data,
      userId: session.user.id,
      idempotencyKey: randomUUID(),
    });
    revalidatePath("/operacao");
    revalidatePath(`/empresas/${parsed.data.companyId}`);
    return { success: true, interactionId: interaction.id };
  } catch (error) {
    if (error instanceof Error && error.message === "CONTACT_NOT_FOUND") {
      return { error: "O contato selecionado não está mais disponível." };
    }
    return { error: "Não foi possível registrar a comunicação." };
  }
}

export async function correctLatestInteractionResult(
  _state: OperationActionState,
  formData: FormData
): Promise<OperationActionState> {
  const session = await requireSession();
  const parsed = correctInteractionSchema.safeParse({
    companyId: formData.get("companyId"),
    interactionId: formData.get("interactionId"),
    correctedResult: formData.get("correctedResult"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: "Revise o resultado corrigido e informe o motivo." };
  }

  try {
    await OperationService.correctLatestInteraction({
      ...parsed.data,
      userId: session.user.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INTERACTION_NOT_LATEST") {
      return { error: "O histórico mudou. Atualize a página e tente novamente." };
    }
    return { error: "Não foi possível registrar a correção." };
  }
  revalidatePath(`/empresas/${parsed.data.companyId}`);
  revalidatePath("/operacao");
  revalidatePath("/");
  revalidatePath("/relatorios");
  return { success: true };
}

export async function saveInteraction(
  _state: OperationActionState,
  formData: FormData
): Promise<OperationActionState> {
  const session = await requireSession();
  const parsed = saveInteractionSchema.safeParse({
    baseId: formData.get("baseId"),
    companyId: formData.get("companyId"),
    result: formData.get("result"),
    nextStage: formData.get("nextStage"),
    qualification: formData.get("qualification"),
    qualificationReason: formData.get("qualificationReason") || undefined,
    contactId: formData.get("contactId") || undefined,
    contactUsed: formData.get("contactUsed") || undefined,
    notes: formData.get("notes") || undefined,
    idempotencyKey: formData.get("idempotencyKey"),
    apiInteractionId: formData.get("apiInteractionId") || undefined,
    followUpAt: formData.get("followUpAt") || undefined,
    followUpReason: formData.get("followUpReason") || undefined,
    view: formData.get("view"),
  });
  if (!parsed.success || !isOperationView(parsed.data.view)) {
    return { error: "Revise o resultado e os dados do atendimento." };
  }

  try {
    await OperationService.saveInteraction({
      ...parsed.data,
      view: parsed.data.view,
      userId: session.user.id,
    });
    revalidatePath("/operacao");
    revalidatePath(`/empresas/${parsed.data.companyId}`);
    revalidatePath("/");
    revalidatePath("/relatorios");
    return { success: true };
  } catch (error) {
    if (
      error instanceof Error &&
      ["COMPANY_ASSIGNED", "CONCURRENT_UPDATE"].includes(error.message)
    ) {
      return {
        error:
          "Esta empresa foi atualizada por outro usuário. Recarregue a fila antes de continuar.",
      };
    }
    if (error instanceof Error && error.message === "MEMBERSHIP_NOT_FOUND") {
      return { error: "A empresa não pertence mais à base selecionada." };
    }
    if (error instanceof Error && error.message === "CONTACT_NOT_FOUND") {
      return { error: "O contato selecionado não está mais disponível." };
    }
    return { error: "Não foi possível registrar a interação." };
  }
}

export async function moveOperationCursor(formData: FormData) {
  const session = await requireSession();
  const baseId = String(formData.get("baseId") || "");
  const companyId = String(formData.get("companyId") || "") || null;
  const previousCompanyId =
    String(formData.get("previousCompanyId") || "") || null;
  const viewValue = String(formData.get("view") || "");
  if (!baseId || !isOperationView(viewValue)) return;

  await OperationService.moveCursor({
    userId: session.user.id,
    baseId,
    companyId,
    previousCompanyId,
    view: viewValue,
  });
  revalidatePath("/operacao");
  refresh();
}
