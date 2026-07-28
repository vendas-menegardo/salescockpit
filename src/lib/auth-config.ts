import type { Prisma, PrismaClient } from "@prisma/client";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

const protectedAdminPaths = [
  "/admin/set-role",
  "/admin/update-user",
  "/admin/ban-user",
  "/admin/unban-user",
  "/admin/remove-user",
  "/admin/impersonate-user",
  "/admin/stop-impersonating",
  "/admin/set-user-password",
];

export function createSalesCockpitAuth(
  database: PrismaClient | Prisma.TransactionClient,
  options: {
    useAdapterTransactions?: boolean;
    useNextCookies: boolean;
  }
) {
  return betterAuth({
    appName: "SalesCockpit",
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: prismaAdapter(database, {
      provider: "postgresql",
      transaction: options.useAdapterTransactions ?? true,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 60,
    },
    disabledPaths: protectedAdminPaths,
    plugins: [
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
        bannedUserMessage:
          "Esta conta está inativa. Entre em contato com um administrador.",
      }),
      ...(options.useNextCookies ? [nextCookies()] : []),
    ],
    telemetry: {
      enabled: false,
    },
  });
}
