"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Database,
  Search,
  Settings,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const menu = [
  {
    name: "Bases",
    href: "/bases",
    icon: Database,
  },
  {
    name: "Empresas",
    href: "/empresas",
    icon: Building2,
  },
  {
    name: "Busca",
    href: "/busca",
    icon: Search,
  },
  {
    name: "Importação",
    href: "/importacao",
    icon: Upload,
  },
  {
    name: "Configurações",
    href: "/configuracoes",
    icon: Settings,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 p-6">
        <h1 className="text-2xl font-bold">
          Sales<span className="text-blue-600">Cockpit</span>
        </h1>
      </div>

      <nav className="space-y-2 p-4">
        {menu.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 transition",
                pathname === item.href
                  ? "bg-blue-600 text-white"
                  : "hover:bg-zinc-100"
              )}
            >
              <Icon size={18} />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
