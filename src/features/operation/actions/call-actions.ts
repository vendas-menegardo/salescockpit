"use server";

import {
  InteractionOrigin,
  InteractionResult,
  Prisma,
} from "@prisma/client";
import { z } from "zod";

import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import {
  dialWithApi4Com,
  getApi4ComConfig,
  normalizeDialPhone,
} from "../services/api4com-service";

export type CallActionState = {
  status?: "started" | "not-configured" | "error";
  message?: string;
  interactionId?: string;
};

const callSchema = z.object({
  companyId: z.string().min(1),
  baseId: z.string().min(1),
  phone: z.string().min(1),
  idempotencyKey: z.string().uuid(),
});

export async function startCompanyCall(
  _state: CallActionState,
  formData: FormData
): Promise<CallActionState> {
  const session = await requireSession();
  const parsed = callSchema.safeParse({
    companyId: formData.get("companyId"),
    baseId: formData.get("baseId"),
    phone: formData.get("phone"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Telefone inválido para ligação." };
  }
  const phone = normalizeDialPhone(parsed.data.phone);
  if (!phone) {
    return { status: "error", message: "Telefone inválido para ligação." };
  }

  const [membership, user] = await Promise.all([
    prisma.baseCompany.findUnique({
      where: {
        baseId_companyId: {
          baseId: parsed.data.baseId,
          companyId: parsed.data.companyId,
        },
      },
      select: { stage: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { api4ComExtension: true },
    }),
  ]);
  if (!membership) {
    return {
      status: "error",
      message: "A empresa não pertence à base selecionada.",
    };
  }
  const config = getApi4ComConfig(user?.api4ComExtension);
  if (!config) {
    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    return {
      status: "not-configured",
      message: isAdmin
        ? "API4Com não configurada. Defina token e ramal no ambiente."
        : "Use a cópia do telefone para realizar a discagem manual.",
    };
  }

  const existing = await prisma.salesInteraction.findUnique({
    where: { idempotencyKey: parsed.data.idempotencyKey },
    select: { id: true, externalCallId: true },
  });
  if (existing) {
    return {
      status: "started",
      message: "A solicitação de ligação já foi enviada.",
      interactionId: existing.id,
    };
  }

  let interaction;
  try {
    interaction = await prisma.salesInteraction.create({
      data: {
        companyId: parsed.data.companyId,
        baseId: parsed.data.baseId,
        userId: session.user.id,
        channel: "CALL",
        contactUsed: phone,
        previousStage: membership.stage,
        nextStage: membership.stage,
        origin: InteractionOrigin.API4COM,
        idempotencyKey: parsed.data.idempotencyKey,
        startedAt: new Date(),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const concurrent = await prisma.salesInteraction.findUnique({
        where: { idempotencyKey: parsed.data.idempotencyKey },
        select: { id: true },
      });
      return {
        status: "started",
        message: "A solicitação de ligação já foi enviada.",
        interactionId: concurrent?.id,
      };
    }
    return {
      status: "error",
      message: "Não foi possível preparar a ligação.",
    };
  }

  try {
    const call = await dialWithApi4Com({
      config,
      phone,
      metadata: {
        gateway: "salescockpit",
        userId: session.user.id,
        companyId: parsed.data.companyId,
        baseId: parsed.data.baseId,
        interactionId: interaction.id,
      },
    });
    await prisma.salesInteraction.update({
      where: { id: interaction.id },
      data: { externalCallId: call.id },
    });
    return {
      status: "started",
      message: "Ligação solicitada.",
      interactionId: interaction.id,
    };
  } catch {
    await prisma.salesInteraction.update({
      where: { id: interaction.id },
      data: {
        result: InteractionResult.ERRO_TECNICO,
        endedAt: new Date(),
        hangupCause: "Falha ao solicitar ligação",
      },
    });
    return {
      status: "error",
      message:
        "A telefonia não iniciou a chamada. Use a discagem manual e tente novamente depois.",
    };
  }
}
