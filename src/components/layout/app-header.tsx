"use client";

import { LogOut, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/actions/auth-actions";
import { isAdminRole } from "@/features/auth/lib/access-control";

type AppHeaderProps = {
  onOpenNavigation: () => void;
  user: {
    email: string;
    name: string;
    role?: string | null;
  };
};

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U"
  );
}

export function AppHeader({ onOpenNavigation, user }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 sm:px-6 lg:px-8">
      <Button
        aria-label="Abrir navegação"
        className="lg:hidden"
        onClick={onOpenNavigation}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Menu />
      </Button>

      <div className="ml-auto flex min-w-0 items-center gap-3">
        <div className="hidden min-w-0 text-right sm:block">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-zinc-500">
            {isAdminRole(user.role) ? "Administrador" : "Usuário"}
          </p>
        </div>

        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white"
        >
          {initials(user.name)}
        </span>

        <form action={logout}>
          <Button type="submit" variant="ghost">
            <LogOut data-icon="inline-start" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
