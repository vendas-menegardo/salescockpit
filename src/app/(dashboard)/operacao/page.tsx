import Link from "next/link";

import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { OperationWorkspace } from "@/features/operation/components/operation-workspace";
import {
  isOperationView,
  OPERATION_VIEWS,
} from "@/features/operation/constants";
import { OperationService } from "@/features/operation/services/operation-service";
import { requireSession } from "@/lib/auth-session";

export default async function OperacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ baseId?: string; view?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const requestedView = params.view || "";
  const view = isOperationView(requestedView) ? requestedView : "not-worked";
  const workspace = await OperationService.getWorkspace({
    userId: session.user.id,
    baseId: params.baseId,
    view,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operação"
        description="Trabalhe a fila comercial da base selecionada."
      />

      <form className="flex max-w-xl flex-wrap items-end gap-2">
        <label className="grid min-w-64 flex-1 gap-1 text-sm">
          Base
          <select
            name="baseId"
            defaultValue={workspace.selectedBaseId ?? ""}
            className="h-9 rounded-lg border border-input bg-white px-2.5"
          >
            {workspace.bases.map((base) => (
              <option key={base.id} value={base.id}>
                {base.name} ({base.companiesCount.toLocaleString("pt-BR")})
              </option>
            ))}
          </select>
        </label>
        <input type="hidden" name="view" value={view} />
        <Button type="submit">Selecionar</Button>
      </form>

      <nav className="flex flex-wrap gap-2" aria-label="Visões da fila">
        {OPERATION_VIEWS.map((item) => (
          <Button
            key={item.value}
            variant={view === item.value ? "default" : "outline"}
            nativeButton={false}
            render={
              <Link
                href={`/operacao?baseId=${workspace.selectedBaseId ?? ""}&view=${item.value}`}
              />
            }
          >
            {item.label}
          </Button>
        ))}
      </nav>

      {!workspace.selectedBaseId ? (
        <EmptyState
          title="Nenhuma base ativa"
          description="Ative uma base para iniciar a operação comercial."
        />
      ) : !workspace.current ? (
        <EmptyState
          title="Fila concluída"
          description="Não há empresas nesta visão para a base selecionada."
        />
      ) : (
        <>
          <p className="text-sm text-zinc-500">
            {workspace.total.toLocaleString("pt-BR")} empresa
            {workspace.total === 1 ? "" : "s"} nesta fila. Mostrando até 50
            para navegação imediata.
          </p>
          <OperationWorkspace
            key={workspace.current.companyId}
            current={workspace.current}
            previous={workspace.previous}
            queue={workspace.queue}
            baseId={workspace.selectedBaseId}
            view={view}
            operationScript={
              workspace.bases.find(
                (base) => base.id === workspace.selectedBaseId
              )?.operationScript ?? null
            }
          />
        </>
      )}
    </div>
  );
}
