"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth-session";
import { isOperationView } from "../constants";
import { OperationService } from "../services/operation-service";
import { saveInteractionSchema } from "../validations/operation-schema";

export type OperationActionState = {
  error?: string;
  success?: boolean;
};

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
}
