"use client";

import { Bell, ChevronDown, LogOut, Search, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-8">
      <div className="relative w-96">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />

        <input
          placeholder="Pesquisar..."
          className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-4 outline-none transition focus:border-blue-500"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Notificações"
          className="rounded-lg p-2 hover:bg-zinc-100"
        >
          <Bell size={20} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            aria-label="Abrir menu do perfil"
            className="flex h-10 items-center gap-2 rounded-lg px-1.5 outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">
              B
            </span>
            <ChevronDown size={16} className="text-zinc-500" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem>
              <UserRound />
              Meu perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
