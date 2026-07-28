"use client";

import { useActionState } from "react";
import { LoaderCircle, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  login,
  type LoginState,
} from "@/features/auth/actions/auth-actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          E-mail
        </label>
        <Input
          autoComplete="email"
          autoFocus
          disabled={pending}
          id="email"
          name="email"
          placeholder="seu.nome@empresa.com.br"
          required
          type="email"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">
          Senha
        </label>
        <Input
          autoComplete="current-password"
          disabled={pending}
          id="password"
          minLength={12}
          name="password"
          required
          type="password"
        />
      </div>

      {state.message && (
        <p
          aria-live="polite"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {state.message}
        </p>
      )}

      <Button className="w-full" disabled={pending} size="lg" type="submit">
        {pending ? (
          <LoaderCircle className="animate-spin" data-icon="inline-start" />
        ) : (
          <LogIn data-icon="inline-start" />
        )}
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
