"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Database,
  LayoutDashboard,
  PhoneCall,
  Sparkles,
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
    group: "Trabalho",
  },
  {
    name: "Operação",
    href: "/operacao",
    icon: PhoneCall,
    group: "Trabalho",
  },
  {
    name: "Bases",
    href: "/bases",
    icon: Database,
    group: "Dados",
  },
  {
    name: "Empresas",
    href: "/empresas",
    icon: Building2,
    group: "Dados",
  },
  {
    name: "Enriquecimento",
    href: "/enriquecimento",
    icon: Sparkles,
    group: "Dados",
  },
  {
    name: "Importação",
    href: "/importacao",
    icon: Upload,
    group: "Dados",
  },
  {
    name: "Relatórios",
    href: "/relatorios",
    icon: BarChart3,
    group: "Gestão",
  },
  {
    name: "Usuários",
    href: "/usuarios",
    icon: Users,
    group: "Gestão",
  },
  {
    name: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    group: "Gestão",
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
  const groups = ["Trabalho", "Dados", "Gestão"];

  return (
    <aside
      className={cn(
        "sticky top-0 h-dvh w-64 shrink-0 overflow-y-auto border-r border-zinc-200/80 bg-[#fbfcfe]",
        className
      )}
    >
      <div className="flex h-16 items-center border-b border-zinc-200/80 px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-sm">SC</span>
          <div>
            <h1 className="text-[17px] font-bold leading-none text-zinc-950">SalesCockpit</h1>
            <p className="mt-1 text-[10px] font-semibold uppercase text-zinc-400">Operação comercial</p>
          </div>
        </div>
      </div>

      <nav className="space-y-5 p-3 pb-6" aria-label="Navegação principal">
        {groups.map((group) => (
          <div key={group}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase text-zinc-400">{group}</p>
            <div className="space-y-1">
            {visibleItems.filter((item) => item.group === group).map((item) => {
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
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset",
                isActive
                  ? "bg-blue-50 text-blue-700 shadow-[inset_3px_0_0_#155eef]"
                  : "bg-transparent text-zinc-600 hover:bg-white hover:text-zinc-950 hover:shadow-sm"
              )}
            >
              <Icon size={18} className={isActive ? "text-blue-600" : "text-zinc-400 transition group-hover:text-zinc-700"} />
              {item.name}
            </Link>
          );
        })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
