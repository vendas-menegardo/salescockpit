"use client";

import { Bell, Search, Settings } from "lucide-react";

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
        <button className="rounded-lg p-2 hover:bg-zinc-100">
          <Bell size={20} />
        </button>

        <button className="rounded-lg p-2 hover:bg-zinc-100">
          <Settings size={20} />
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">
          B
        </div>
      </div>
    </header>
  );
}