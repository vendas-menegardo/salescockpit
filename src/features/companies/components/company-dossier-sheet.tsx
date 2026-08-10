"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function CompanyDossierSheet({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("companyId");
    router.replace(`/empresas${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-5 py-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Cadastro, contatos e histórico da empresa selecionada.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 p-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
