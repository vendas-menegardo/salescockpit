import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || null);

export const companyProfileSchema = z.object({
  companyId: z.string().min(1),
  corporateName: z.string().trim().min(2).max(255),
  tradeName: optionalText(255),
  segment: optionalText(180),
  email: z.union([z.literal(""), z.string().trim().email().max(255)])
    .transform((value) => value || null),
  phone: optionalText(255),
  website: optionalText(500),
  registrationStatus: optionalText(120),
  legalNature: optionalText(255),
  description: optionalText(2000),
  address: optionalText(500),
  district: optionalText(180),
  postalCode: optionalText(20),
  city: optionalText(180),
  state: z.string().trim().max(2).transform((value) => value.toUpperCase() || null),
  notes: optionalText(4000),
});
