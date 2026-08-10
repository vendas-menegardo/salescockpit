"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      aria-labelledby="dashboard-error-title"
      className="workspace-surface rounded-lg border-red-200 p-6"
    >
      <h1 className="text-lg font-semibold" id="dashboard-error-title">
        Não foi possível carregar esta página
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Tente novamente. Se o problema continuar, entre em contato com um
        administrador.
      </p>
      <Button className="mt-4" onClick={reset} type="button" variant="outline">
        <RefreshCw data-icon="inline-start" />
        Tentar novamente
      </Button>
    </section>
  );
}
