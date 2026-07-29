import { NextResponse } from "next/server";

import {
  api4ComWebhookSchema,
  isValidWebhookSecret,
} from "@/features/operation/services/api4com-service";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!isValidWebhookSecret(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const payload = api4ComWebhookSchema.safeParse(body);
  if (!payload.success || !payload.data.metadata.interactionId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const interaction = await prisma.salesInteraction.findUnique({
    where: { id: payload.data.metadata.interactionId },
    select: {
      id: true,
      companyId: true,
      baseId: true,
      userId: true,
      externalCallId: true,
      endedAt: true,
    },
  });
  if (
    !interaction ||
    interaction.companyId !== payload.data.metadata.companyId ||
    interaction.baseId !== payload.data.metadata.baseId ||
    interaction.userId !== payload.data.metadata.userId ||
    (interaction.externalCallId &&
      interaction.externalCallId !== payload.data.id)
  ) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (!interaction.endedAt) {
    await prisma.salesInteraction.update({
      where: { id: interaction.id },
      data: {
        externalCallId: payload.data.id,
        startedAt: payload.data.startedAt,
        answeredAt: payload.data.answeredAt,
        endedAt: payload.data.endedAt,
        durationSeconds: payload.data.duration,
        hangupCause: payload.data.hangupCause,
        recordingUrl: payload.data.recordUrl,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
