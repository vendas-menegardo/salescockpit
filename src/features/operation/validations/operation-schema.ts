import {
  CommercialStage,
  CompanyQualification,
  InteractionResult,
} from "@prisma/client";
import { z } from "zod";

export const saveInteractionSchema = z
  .object({
    baseId: z.string().min(1),
    companyId: z.string().min(1),
    result: z.nativeEnum(InteractionResult),
    nextStage: z.nativeEnum(CommercialStage),
    qualification: z.nativeEnum(CompanyQualification),
    qualificationReason: z.string().trim().max(500).optional(),
    contactId: z.string().trim().min(1).optional(),
    contactUsed: z.string().trim().max(255).optional(),
    notes: z.string().trim().max(2000).optional(),
    idempotencyKey: z.string().uuid(),
    apiInteractionId: z.string().optional(),
    followUpAt: z.string().optional(),
    followUpReason: z.string().trim().max(500).optional(),
    view: z.string().min(1),
  })
  .superRefine((data, context) => {
    if (!data.contactUsed) {
      context.addIssue({
        code: "custom",
        message: "Selecione o telefone utilizado na tentativa.",
        path: ["contactUsed"],
      });
    }
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
    if (
      ["CONGELADA", "PERDIDA", "INAPTA"].includes(data.qualification) &&
      !data.qualificationReason
    ) {
      context.addIssue({
        code: "custom",
        path: ["qualificationReason"],
        message: "Informe o motivo da classificação.",
      });
    }
  });

export const updateQualificationSchema = z
  .object({
    baseId: z.string().min(1),
    companyId: z.string().min(1),
    qualification: z.nativeEnum(CompanyQualification),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((data, context) => {
    if (
      ["CONGELADA", "PERDIDA", "INAPTA"].includes(data.qualification) &&
      !data.reason
    ) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Informe o motivo da classificação.",
      });
    }
  });

export const communicationEventSchema = z.object({
  baseId: z.string().min(1),
  companyId: z.string().min(1),
  contactId: z.string().min(1).optional(),
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  result: z.enum([
    "EMAIL_PREPARADO",
    "EMAIL_ENVIADO",
    "EMAIL_RESPOSTA",
    "WHATSAPP_PREPARADO",
    "WHATSAPP_ENVIADO",
  ]),
  contactUsed: z.string().trim().min(3).max(255),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().max(2000).optional(),
}).superRefine((data, context) => {
  const expectedPrefix = data.channel === "EMAIL" ? "EMAIL_" : "WHATSAPP_";
  if (!data.result.startsWith(expectedPrefix)) {
    context.addIssue({
      code: "custom",
      path: ["result"],
      message: "O resultado não corresponde ao canal selecionado.",
    });
  }
});

export const correctInteractionSchema = z.object({
  companyId: z.string().min(1),
  interactionId: z.string().min(1),
  correctedResult: z.nativeEnum(InteractionResult),
  reason: z.string().trim().min(3).max(500),
});
