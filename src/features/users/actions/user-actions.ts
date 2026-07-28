"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { APP_ROLES } from "@/features/auth/lib/access-control";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { validateUserUpdatePolicy } from "../lib/user-policy";
import {
  createUserSchema,
  updateUserSchema,
} from "../validations/user-schema";

export type UserActionState = {
  message?: string;
  success?: boolean;
};

const adminPolicyLockKey = 8_492_713;

export async function createUser(
  _previousState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  await requireAdmin();

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Revise os dados informados.",
    };
  }

  try {
    await auth.api.createUser({
      body: parsed.data,
      headers: await headers(),
    });
  } catch {
    return {
      message:
        "Não foi possível criar o usuário. Confirme se o e-mail já está cadastrado.",
    };
  }

  revalidatePath("/usuarios");

  return {
    message: "Usuário criado com sucesso.",
    success: true,
  };
}

export async function updateUser(
  _previousState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const session = await requireAdmin();
  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    role: formData.get("role"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Revise os dados informados.",
    };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(${adminPolicyLockKey})
      `;

      const [target, activeAdminCount] = await Promise.all([
        transaction.user.findUnique({
          where: { id: parsed.data.userId },
          select: {
            banned: true,
            id: true,
            role: true,
          },
        }),
        transaction.user.count({
          where: {
            banned: false,
            role: APP_ROLES.ADMIN,
          },
        }),
      ]);

      if (!target) {
        throw new Error("USER_NOT_FOUND");
      }

      const policyError = validateUserUpdatePolicy({
        activeAdminCount,
        currentRole: target.role,
        currentUserId: session.user.id,
        nextActive: parsed.data.active,
        nextRole: parsed.data.role,
        targetUserId: target.id,
        targetWasActive: !target.banned,
      });

      if (policyError) {
        throw new Error(`USER_POLICY:${policyError}`);
      }

      await transaction.user.update({
        where: { id: target.id },
        data: {
          banned: !parsed.data.active,
          banExpires: null,
          banReason: parsed.data.active
            ? null
            : "Conta desativada por um administrador.",
          name: parsed.data.name,
          role: parsed.data.role,
        },
      });

      if (!parsed.data.active) {
        await transaction.session.deleteMany({
          where: { userId: target.id },
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("USER_POLICY:")) {
      return {
        message: error.message.slice("USER_POLICY:".length),
      };
    }

    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return {
        message: "O usuário não foi encontrado.",
      };
    }

    return {
      message: "Não foi possível atualizar o usuário. Tente novamente.",
    };
  }

  revalidatePath("/usuarios");

  return {
    message: "Usuário atualizado com sucesso.",
    success: true,
  };
}
