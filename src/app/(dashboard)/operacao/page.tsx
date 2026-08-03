import { randomUUID } from "node:crypto";
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
  searchParams: Promise<{
    baseId?: string;
    view?: string;
    companyId?: string;
    returnTo?: string;
  }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const requestedView = params.view || "";
  const view = isOperationView(requestedView) ? requestedView : "not-worked";
  const workspace = await OperationService.getWorkspace({
    userId: session.user.id,
    baseId: params.baseId,
    view,
    companyId: params.companyId,
  });

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-full lg:overflow-hidden">
      <div className="grid shrink-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,36rem)] lg:items-end">
        <PageHeader
          title="Operação"
          description="Trabalhe a fila comercial da base selecionada."
        />

        <form className="flex min-w-0 items-end gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="shrink-0 font-medium text-zinc-600">Base</span>
            <select
              name="baseId"
              defaultValue={workspace.selectedBaseId ?? ""}
              className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-white px-2.5"
            >
              {workspace.bases.map((base) => (
                <option key={base.id} value={base.id}>
                  {base.name} ({base.companiesCount.toLocaleString("pt-BR")})
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="view" value={view} />
          <Button
            type="submit"
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Selecionar
          </Button>
        </form>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <nav
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1"
          aria-label="Visões da fila"
        >
          {OPERATION_VIEWS.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={view === item.value ? "default" : "outline"}
              className={
                view === item.value
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : undefined
              }
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
        {workspace.selectedBaseId && (
          <p className="hidden shrink-0 text-xs text-zinc-500 xl:block">
            {workspace.total.toLocaleString("pt-BR")} empresa
            {workspace.total === 1 ? "" : "s"} nesta fila
          </p>
        )}
      </div>

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
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <p className="shrink-0 text-xs text-zinc-500 xl:hidden">
            {workspace.total.toLocaleString("pt-BR")} empresa
            {workspace.total === 1 ? "" : "s"} nesta fila
          </p>
          <OperationWorkspace
            key={workspace.current.companyId}
            current={workspace.current}
            previous={workspace.previous}
            queue={workspace.queue}
            baseId={workspace.selectedBaseId}
            view={view}
            returnTo={
              params.returnTo?.startsWith("/empresas") ? params.returnTo : undefined
            }
            idempotencyKey={randomUUID()}
            callIdempotencyKey={randomUUID()}
            operationScript={
              workspace.bases.find(
                (base) => base.id === workspace.selectedBaseId
              )?.operationScript ?? null
            }
          />
        </div>
      )}
    </div>
  );
}
