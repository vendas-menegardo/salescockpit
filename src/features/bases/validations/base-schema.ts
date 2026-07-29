import { z } from "zod";

export const createBaseSchema = z.object({
  name: z.string().trim().min(3, "Informe um nome."),
  description: z.string().optional(),
  operationScript: z.string().max(5000).optional(),
  segment: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
});

export type CreateBaseInput = z.infer<typeof createBaseSchema>;
