"use client";

import { useActionState } from "react";
import { LoaderCircle, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateUser,
  type UserActionState,
} from "@/features/users/actions/user-actions";

type UserRowProps = {
  currentUserId: string;
  user: {
    banned: boolean;
    email: string;
    id: string;
    lastSessionAt: string | null;
    name: string;
    role: string;
  };
};

const initialState: UserActionState = {};

export function UserRow({ currentUserId, user }: UserRowProps) {
  const [state, action, pending] = useActionState(updateUser, initialState);
  const isCurrentUser = currentUserId === user.id;

  return (
    <form
      action={action}
      className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(12rem,1.4fr)_minmax(9rem,0.7fr)_auto_auto] md:items-end"
    >
      <input name="userId" type="hidden" value={user.id} />

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-500" htmlFor={`name-${user.id}`}>
          Nome
        </label>
        <Input
          defaultValue={user.name}
          disabled={pending}
          id={`name-${user.id}`}
          maxLength={120}
          name="name"
          required
        />
        <p className="truncate text-xs text-zinc-500">{user.email}</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-500" htmlFor={`role-${user.id}`}>
          Perfil
        </label>
        <select
          className="h-8 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
          defaultValue={user.role}
          disabled={pending || isCurrentUser}
          id={`role-${user.id}`}
          name="role"
        >
          <option value="user">USER</option>
          <option value="admin">ADMIN</option>
        </select>
        {isCurrentUser && <input name="role" type="hidden" value={user.role} />}
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            className="h-4 w-4 accent-blue-600"
            defaultChecked={!user.banned}
            disabled={pending || isCurrentUser}
            name="active"
            type="checkbox"
          />
          Conta ativa
        </label>
        {isCurrentUser && <input name="active" type="hidden" value="on" />}
        <div className="flex items-center gap-2">
          <Badge variant={user.banned ? "secondary" : "default"}>
            {user.banned ? "Inativo" : "Ativo"}
          </Badge>
          <span className="text-xs text-zinc-500">
            {user.lastSessionAt
              ? `Login: ${new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(user.lastSessionAt))}`
              : "Nunca acessou"}
          </span>
        </div>
      </div>

      <Button disabled={pending} type="submit" variant="outline">
        {pending ? (
          <LoaderCircle className="animate-spin" data-icon="inline-start" />
        ) : (
          <Save data-icon="inline-start" />
        )}
        {pending ? "Salvando..." : "Salvar"}
      </Button>

      {state.message && (
        <p
          aria-live="polite"
          className={
            state.success
              ? "text-sm text-emerald-700 md:col-span-4"
              : "text-sm text-red-700 md:col-span-4"
          }
          role={state.success ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
