import { ContactType, ContactValidity } from "@prisma/client";
import { z } from "zod";

export const companyContactSchema = z.object({
  companyId: z.string().min(1),
  type: z.nativeEnum(ContactType),
  value: z.string().trim().min(3).max(255),
  isPrimary: z.boolean().default(false),
  isWhatsapp: z.boolean().default(false),
  responsibleName: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
  source: z.string().trim().max(120).optional(),
  validity: z.nativeEnum(ContactValidity).default(ContactValidity.UNKNOWN),
  notes: z.string().trim().max(500).optional(),
});

export const editCompanyContactSchema = companyContactSchema
  .pick({
    value: true,
    isWhatsapp: true,
    responsibleName: true,
    role: true,
    notes: true,
  })
  .extend({
    contactId: z.string().min(1),
  });

export const editPrimaryPhoneSchema = z.object({
  companyId: z.string().min(1),
  value: z.string().trim().min(8).max(255),
  responsibleName: z.string().trim().max(120).optional(),
});
