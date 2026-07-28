"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Database,
  LayoutDashboard,
  PhoneCall,
  Search,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Operação",
    href: "/operacao",
    icon: PhoneCall,
  },
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
    title: "Pesquisa",
    href: "/pesquisa",
    icon: Search,
  },
  {
    title: "Importação",
    href: "/importacao",
    icon: Upload,
  },
  {
    title: "Relatórios",
    href: "/relatorios",
    icon: BarChart3,
  },
  {
    title: "Usuários",
    href: "/usuarios",
    icon: Users,
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
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
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
