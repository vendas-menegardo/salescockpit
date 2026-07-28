import { z } from "zod";

import { APP_ROLES } from "@/features/auth/lib/access-control";

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do usuário.").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail válido.")
    .max(320),
  password: z
    .string()
    .min(12, "A senha deve ter pelo menos 12 caracteres.")
    .max(128),
  role: z.enum([APP_ROLES.ADMIN, APP_ROLES.USER]),
});
export const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2, "Informe o nome do usuário.").max(120),
  role: z.enum([APP_ROLES.ADMIN, APP_ROLES.USER]),
  active: z.boolean(),
});
