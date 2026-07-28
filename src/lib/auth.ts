import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/prisma";

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

export const auth = betterAuth({
  appName: "SalesCockpit",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true,
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
    nextCookies(),
  ],
  telemetry: {
    enabled: false,
  },
});

export type AuthSession = typeof auth.$Infer.Session;
