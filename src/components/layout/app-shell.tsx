"use client";

import { ReactNode, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

interface AppShellProps {
  children: ReactNode;
  user: {
    email: string;
    name: string;
    role?: string | null;
  };
}

export function AppShell({ children, user }: AppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-zinc-50 lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <AppSidebar className="hidden lg:block" role={user.role} />

      <Sheet
        onOpenChange={setMobileNavigationOpen}
        open={mobileNavigationOpen}
      >
        <SheetContent className="w-72 p-0" showCloseButton side="left">
          <SheetTitle className="sr-only">Navegação principal</SheetTitle>
          <SheetDescription className="sr-only">
            Acesse os módulos do SalesCockpit.
          </SheetDescription>
          <AppSidebar
            className="w-full border-r-0"
            onNavigate={() => setMobileNavigationOpen(false)}
            role={user.role}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader
          onOpenNavigation={() => setMobileNavigationOpen(true)}
          user={user}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-5 xl:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
