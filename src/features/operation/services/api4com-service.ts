import "server-only";

import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

const dialResponseSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
});

export type Api4ComConfig = {
  token: string;
  extension: string;
};

export function getApi4ComConfig(
  userExtension?: string | null
): Api4ComConfig | null {
  const token = process.env.API4COM_TOKEN?.trim();
  const extension =
    userExtension?.trim() || process.env.API4COM_EXTENSION?.trim();
  if (!token || !extension) return null;
  return { token, extension };
}

export function normalizeDialPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export async function dialWithApi4Com({
  config,
  phone,
  metadata,
}: {
  config: Api4ComConfig;
  phone: string;
  metadata: Record<string, string>;
}) {
  const response = await fetch("https://api.api4com.com/api/v1/dialer", {
    method: "POST",
    headers: {
      Authorization: config.token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      extension: config.extension,
      phone,
      metadata,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("API4COM_DIAL_FAILED");
  return dialResponseSchema.parse(await response.json());
}

export const api4ComWebhookSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  startedAt: z.coerce.date().optional(),
  answeredAt: z.coerce.date().nullable().optional(),
  endedAt: z.coerce.date().optional(),
  duration: z.coerce.number().int().nonnegative().optional(),
  hangupCause: z.string().max(255).optional(),
  recordUrl: z.string().url().optional(),
  metadata: z
    .object({
      gateway: z.string().optional(),
      userId: z.string().optional(),
      companyId: z.string().optional(),
      baseId: z.string().optional(),
      interactionId: z.string().optional(),
    })
    .passthrough(),
});

export function isValidWebhookSecret(request: Request) {
  const expected = process.env.API4COM_WEBHOOK_SECRET;
  const provided = request.headers.get("x-api4com-webhook-secret");
  if (!expected || !provided) return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
}
