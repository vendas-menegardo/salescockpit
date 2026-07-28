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
import { canAccessRoute } from "@/features/auth/lib/access-control";
import { cn } from "@/lib/utils";

const menu = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Operação",
    href: "/operacao",
    icon: PhoneCall,
  },
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
    name: "Pesquisa",
    href: "/pesquisa",
    icon: Search,
  },
  {
    name: "Importação",
    href: "/importacao",
    icon: Upload,
  },
  {
    name: "Relatórios",
    href: "/relatorios",
    icon: BarChart3,
  },
  {
    name: "Usuários",
    href: "/usuarios",
    icon: Users,
  },
  {
    name: "Configurações",
    href: "/configuracoes",
    icon: Settings,
  },
];

type AppSidebarProps = {
  className?: string;
  onNavigate?: () => void;
  role?: string | null;
};

export function AppSidebar({
  className,
  onNavigate,
  role,
}: AppSidebarProps) {
  const pathname = usePathname();
  const visibleItems = menu.filter((item) => canAccessRoute(role, item.href));

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen w-64 shrink-0 overflow-y-auto border-r border-zinc-200 bg-white",
        className
      )}
    >
      <div className="border-b border-zinc-200 p-6">
        <h1 className="text-2xl font-bold">
          Sales<span className="text-blue-600">Cockpit</span>
        </h1>
      </div>

      <nav className="space-y-1 p-4 pb-8">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset",
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-transparent hover:bg-zinc-100"
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
