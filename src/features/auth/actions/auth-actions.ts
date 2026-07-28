"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { loginSchema } from "@/features/auth/validations/auth-schema";
import { auth } from "@/lib/auth";

export type LoginState = {
  message?: string;
};

export async function login(
  _previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      message: "Informe um e-mail e uma senha válidos.",
    };
  }

  try {
    await auth.api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
        rememberMe: false,
      },
      headers: await headers(),
    });
  } catch {
    return {
      message:
        "Não foi possível entrar. Verifique suas credenciais e se a conta está ativa.",
    };
  }

  redirect("/");
}

export async function logout() {
  await auth.api.signOut({
    headers: await headers(),
  });

  redirect("/login");
}
