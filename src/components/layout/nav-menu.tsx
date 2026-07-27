"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  Building2,
  Search,
  Upload,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  {
    title: "Bases",
    href: "/bases",
    icon: Database,
  },
  {
    title: "Empresas",
    href: "/empresas",
    icon: Building2,
  },
  {
    title: "Busca",
    href: "/busca",
    icon: Search,
  },
  {
    title: "Importação",
    href: "/importacao",
    icon: Upload,
  },
  {
    title: "Configurações",
    href: "/configuracoes",
    icon: Settings,
  },
];

export function NavMenu() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-2">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon size={18} />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}