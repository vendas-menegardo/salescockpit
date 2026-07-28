"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createUser,
  type UserActionState,
} from "@/features/users/actions/user-actions";

const initialState: UserActionState = {};

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form
      action={action}
      className="grid gap-4 lg:grid-cols-[1.2fr_1.4fr_1fr_0.8fr_auto]"
      ref={formRef}
    >
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="new-user-name">
          Nome
        </label>
        <Input
          disabled={pending}
          id="new-user-name"
          maxLength={120}
          name="name"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="new-user-email">
          E-mail
        </label>
        <Input
          autoComplete="off"
          disabled={pending}
          id="new-user-email"
          maxLength={320}
          name="email"
          required
          type="email"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="new-user-password">
          Senha inicial
        </label>
        <Input
          autoComplete="new-password"
          disabled={pending}
          id="new-user-password"
          maxLength={128}
          minLength={12}
          name="password"
          required
          type="password"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="new-user-role">
          Perfil
        </label>
        <select
          className="h-8 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          disabled={pending}
          id="new-user-role"
          name="role"
        >
          <option value="user">USER</option>
          <option value="admin">ADMIN</option>
        </select>
      </div>

      <Button
        className="self-end"
        disabled={pending}
        type="submit"
      >
        {pending ? (
          <LoaderCircle className="animate-spin" data-icon="inline-start" />
        ) : (
          <UserPlus data-icon="inline-start" />
        )}
        {pending ? "Criando..." : "Criar"}
      </Button>

      {state.message && (
        <p
          aria-live="polite"
          className={state.success ? "text-sm text-emerald-700" : "text-sm text-red-700"}
          role={state.success ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
