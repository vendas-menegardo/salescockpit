import { CommercialStage, InteractionResult } from "@prisma/client";
import { z } from "zod";

export const saveInteractionSchema = z
  .object({
    baseId: z.string().min(1),
    companyId: z.string().min(1),
    result: z.nativeEnum(InteractionResult),
    nextStage: z.nativeEnum(CommercialStage),
    contactUsed: z.string().trim().max(255).optional(),
    notes: z.string().trim().max(2000).optional(),
    idempotencyKey: z.string().uuid(),
    apiInteractionId: z.string().optional(),
    followUpAt: z.string().optional(),
    followUpReason: z.string().trim().max(500).optional(),
    view: z.string().min(1),
  })
  .superRefine((data, context) => {
    if (Boolean(data.followUpAt) !== Boolean(data.followUpReason)) {
      context.addIssue({
        code: "custom",
        message: "Informe a data e o motivo do retorno.",
        path: ["followUpAt"],
      });
    }
    if (data.followUpAt && Number.isNaN(new Date(data.followUpAt).getTime())) {
      context.addIssue({
        code: "custom",
        message: "A data do retorno é inválida.",
        path: ["followUpAt"],
      });
    }
  });
