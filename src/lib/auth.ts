import { createSalesCockpitAuth } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";

export const auth = createSalesCockpitAuth(prisma, {
  useNextCookies: true,
});

export type AuthSession = typeof auth.$Infer.Session;
