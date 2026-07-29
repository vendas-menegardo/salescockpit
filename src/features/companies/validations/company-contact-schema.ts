import { ContactType, ContactValidity } from "@prisma/client";
import { z } from "zod";

export const companyContactSchema = z.object({
  companyId: z.string().min(1),
  type: z.nativeEnum(ContactType),
  value: z.string().trim().min(3).max(255),
  isPrimary: z.boolean().default(false),
  responsibleName: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
  source: z.string().trim().max(120).optional(),
  validity: z.nativeEnum(ContactValidity).default(ContactValidity.UNKNOWN),
  notes: z.string().trim().max(500).optional(),
});
