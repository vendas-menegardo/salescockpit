import Link from "next/link";
import {
  CommercialStage,
  InteractionChannel,
  InteractionResult,
} from "@prisma/client";

import { PageHeader } from "@/components/common/page-header";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  defaultDateRange,
  type AnalyticsFilters,
} from "@/features/analytics/lib/report-filters";
import { AnalyticsService } from "@/features/analytics/services/analytics-service";
import { ExportReportButton } from "@/features/analytics/components/export-report-button";
import { isAdminRole } from "@/features/auth/lib/access-control";
import { formatCnpj } from "@/features/import/lib/import-utils";
import {
  COMMERCIAL_STAGE_LABELS,
  INTERACTION_RESULT_LABELS,
} from "@/features/operation/constants";
import { requireSession } from "@/lib/auth-session";

type ReportParams = Record<string, string | undefined>;

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<ReportParams>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const defaults = defaultDateRange(30);
  const admin = isAdminRole(session.user.role);
  const filters = parseFilters(params, defaults);
  const tab = params.tab === "empresas" ? "empresas" : "operacao";
  const page = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const [metrics, interactions, companies, options] = await Promise.all([
    AnalyticsService.getMetrics(
      filters,
      admin ? undefined : session.user.id
    ),
    AnalyticsService.getInteractionPage({
      filters,
      permittedUserId: admin ? undefined : session.user.id,
      page,
    }),
    AnalyticsService.getCompanyPage({
      filters,
      permittedUserId: admin ? undefined : session.user.id,
      page,
    }),
    AnalyticsService.getFilterOptions(admin),
  ]);
  const exportParams = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] =>
      Boolean(entry[1])
    )
  );
  exportParams.delete("page");
  exportParams.delete("tab");

  return (
    <div className="space-y-7">
      <PageHeader
        title="Relatórios"
        description="Histórico, funil e empresas filtrados pela mesma fonte da Operação."
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportReportButton
              href={`/api/reports/export?${exportParams.toString()}&type=operacao`}
              label="Operação CSV"
            />
            <ExportReportButton
              href={`/api/reports/export?${exportParams.toString()}&type=empresas`}
              label="Empresas CSV"
            />
          </div>
        }
      />

      <ReportFilters
        filters={filters}
        options={options}
        admin={admin}
      />

      <nav className="flex gap-2" aria-label="Visão do relatório">
        <ReportTab
          active={tab === "operacao"}
          href={tabHref(params, "operacao")}
        >
          Histórico operacional
        </ReportTab>
        <ReportTab
          active={tab === "empresas"}
          href={tabHref(params, "empresas")}
        >
          Empresas
        </ReportTab>
      </nav>

      <DashboardSection title="Operação">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ReportMetric label="Tentativas" value={metrics.attempts} />
          <ReportMetric label="Atendidas" value={metrics.answered} />
          <ReportMetric
            label="Empresas únicas"
            value={metrics.uniqueCompanies}
          />
          <ReportMetric
            label="Retornos"
            value={metrics.followUpsScheduled}
          />
          <ReportMetric
            label="Duração total"
            value={formatDuration(metrics.durationSeconds)}
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Funil">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            CommercialStage.QUALIFICADA,
            CommercialStage.REUNIAO_AGENDADA,
            CommercialStage.REUNIAO_REALIZADA,
            CommercialStage.GANHA,
            CommercialStage.PERDIDA,
            CommercialStage.CONGELADA,
          ].map((stage) => (
            <ReportMetric
              key={stage}
              label={COMMERCIAL_STAGE_LABELS[stage]}
              value={metrics.stageCounts[stage]}
            />
          ))}
        </div>
      </DashboardSection>

      <DashboardSection title="Enriquecimento">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ReportMetric
            label="Empresas alteradas"
            value={metrics.enrichedCompanies}
          />
          <ReportMetric
            label="Contatos adicionados"
            value={metrics.contactsAdded}
          />
          <ReportMetric
            label="Contatos validados"
            value={metrics.contactsValidated}
          />
          <ReportMetric
            label="Contatos invalidados"
            value={metrics.contactsInvalidated}
          />
        </div>
      </DashboardSection>

      {tab === "operacao" && (
      <DashboardSection title={`Histórico (${interactions.total.toLocaleString("pt-BR")})`}>
        <div className="workspace-surface overflow-x-auto rounded-lg">
          <table className="data-table min-w-full text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <Th>Data</Th>
                <Th>Empresa</Th>
                <Th>Base</Th>
                <Th>Usuário</Th>
                <Th>Resultado</Th>
                <Th>Próxima etapa</Th>
                <Th>Retorno</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {interactions.rows.map((row) => (
                <tr key={row.id}>
                  <Td>{formatDateTime(row.createdAt)}</Td>
                  <Td>
                    <Link
                      href={`/empresas/${row.company.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {row.company.corporateName}
                    </Link>
                  </Td>
                  <Td>{row.base.name}</Td>
                  <Td>{row.user.name}</Td>
                  <Td>
                    {row.result
                      ? INTERACTION_RESULT_LABELS[row.result]
                      : "Em andamento"}
                  </Td>
                  <Td>{COMMERCIAL_STAGE_LABELS[row.nextStage]}</Td>
                  <Td>
                    {row.followUps[0]
                      ? formatDateTime(row.followUps[0].dueAt)
                      : "-"}
                  </Td>
                </tr>
              ))}
              {interactions.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                    Nenhuma interação encontrada no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DashboardSection>
      )}

      {tab === "empresas" && (
      <DashboardSection title={`Empresas (${companies.total.toLocaleString("pt-BR")})`}>
        <div className="workspace-surface overflow-x-auto rounded-lg">
          <table className="data-table min-w-full text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <Th>CNPJ</Th>
                <Th>Empresa</Th>
                <Th>Base</Th>
                <Th>Etapa</Th>
                <Th>Responsável</Th>
                <Th>Última interação</Th>
                <Th>Próxima ação</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {companies.rows.map((company) => {
                const membership = company.bases[0];
                return (
                  <tr key={company.id}>
                    <Td>{formatCnpj(company.cnpj)}</Td>
                    <Td>
                      <Link
                        href={`/empresas/${company.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {company.corporateName}
                      </Link>
                    </Td>
                    <Td>{membership?.base.name || "-"}</Td>
                    <Td>
                      {membership ? (
                        <Badge variant="outline">
                          {COMMERCIAL_STAGE_LABELS[membership.stage]}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td>{membership?.assignedUser?.name || "-"}</Td>
                    <Td>
                      {company.interactions[0]
                        ? formatDateTime(company.interactions[0].createdAt)
                        : "-"}
                    </Td>
                    <Td>
                      {company.followUps[0]
                        ? formatDateTime(company.followUps[0].dueAt)
                        : "-"}
                    </Td>
                  </tr>
                );
              })}
              {companies.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                    Nenhuma empresa encontrada com estes filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DashboardSection>
      )}

      <Pagination
        page={tab === "operacao" ? interactions.page : companies.page}
        totalPages={
          tab === "operacao"
            ? interactions.totalPages
            : companies.totalPages
        }
        params={params}
      />
    </div>
  );
}

function parseFilters(
  params: ReportParams,
  defaults: { from: string; to: string }
): AnalyticsFilters {
  const stages = new Set(Object.values(CommercialStage));
  const results = new Set(Object.values(InteractionResult));
  const channels = new Set(Object.values(InteractionChannel));
  const followUpStatuses = new Set(["PENDING", "COMPLETED", "CANCELED"]);
  const completeness = new Set([
    "with-phone",
    "with-email",
    "with-site",
    "incomplete",
  ]);
  return {
    from: params.from || defaults.from,
    to: params.to || defaults.to,
    userId: params.userId || undefined,
    baseId: params.baseId || undefined,
    city: params.city || undefined,
    state: params.state || undefined,
    segment: params.segment || undefined,
    stage: stages.has(params.stage as CommercialStage)
      ? (params.stage as CommercialStage)
      : undefined,
    result: results.has(params.result as InteractionResult)
      ? (params.result as InteractionResult)
      : undefined,
    channel: channels.has(params.channel as InteractionChannel)
      ? (params.channel as InteractionChannel)
      : undefined,
    followUpStatus: followUpStatuses.has(params.followUpStatus || "")
      ? (params.followUpStatus as AnalyticsFilters["followUpStatus"])
      : undefined,
    completeness: completeness.has(params.completeness || "")
      ? (params.completeness as AnalyticsFilters["completeness"])
      : undefined,
    query: params.query || undefined,
  };
}

function ReportFilters({
  filters,
  options,
  admin,
}: {
  filters: AnalyticsFilters;
  options: Awaited<ReturnType<typeof AnalyticsService.getFilterOptions>>;
  admin: boolean;
}) {
  return (
    <form className="workspace-surface grid gap-3 rounded-lg p-4 md:grid-cols-3 xl:grid-cols-5">
      <Filter label="Data inicial">
        <input type="date" name="from" defaultValue={filters.from} className={fieldClass} />
      </Filter>
      <Filter label="Data final">
        <input type="date" name="to" defaultValue={filters.to} className={fieldClass} />
      </Filter>
      {admin && (
        <Filter label="Usuário">
          <select name="userId" defaultValue={filters.userId || ""} className={fieldClass}>
            <option value="">Todos</option>
            {options.users.map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </Filter>
      )}
      <Filter label="Base">
        <select name="baseId" defaultValue={filters.baseId || ""} className={fieldClass}>
          <option value="">Todas</option>
          {options.bases.map((base) => (
            <option key={base.id} value={base.id}>{base.name}</option>
          ))}
        </select>
      </Filter>
      <Filter label="Empresa ou CNPJ">
        <input name="query" defaultValue={filters.query} className={fieldClass} />
      </Filter>
      <Filter label="Cidade">
        <input name="city" defaultValue={filters.city} className={fieldClass} />
      </Filter>
      <Filter label="UF">
        <input name="state" defaultValue={filters.state} maxLength={2} className={fieldClass} />
      </Filter>
      <Filter label="Segmento">
        <input name="segment" defaultValue={filters.segment} className={fieldClass} />
      </Filter>
      <Filter label="Etapa">
        <select name="stage" defaultValue={filters.stage || ""} className={fieldClass}>
          <option value="">Todas</option>
          {Object.values(CommercialStage).map((stage) => (
            <option key={stage} value={stage}>{COMMERCIAL_STAGE_LABELS[stage]}</option>
          ))}
        </select>
      </Filter>
      <Filter label="Resultado">
        <select name="result" defaultValue={filters.result || ""} className={fieldClass}>
          <option value="">Todos</option>
          {Object.values(InteractionResult).map((result) => (
            <option key={result} value={result}>{INTERACTION_RESULT_LABELS[result]}</option>
          ))}
        </select>
      </Filter>
      <Filter label="Canal">
        <select name="channel" defaultValue={filters.channel || ""} className={fieldClass}>
          <option value="">Todos</option>
          <option value="CALL">Ligação</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="EMAIL">E-mail</option>
          <option value="INSTAGRAM">Instagram</option>
          <option value="OTHER">Outro</option>
        </select>
      </Filter>
      <Filter label="Retorno">
        <select name="followUpStatus" defaultValue={filters.followUpStatus || ""} className={fieldClass}>
          <option value="">Todos</option>
          <option value="PENDING">Pendente</option>
          <option value="COMPLETED">Concluído</option>
          <option value="CANCELED">Cancelado</option>
        </select>
      </Filter>
      <Filter label="Completude">
        <select name="completeness" defaultValue={filters.completeness || ""} className={fieldClass}>
          <option value="">Todas</option>
          <option value="with-phone">Com telefone</option>
          <option value="with-email">Com e-mail</option>
          <option value="with-site">Com site</option>
          <option value="incomplete">Dossiê incompleto</option>
        </select>
      </Filter>
      <div className="flex items-end gap-2">
        <Button type="submit">Filtrar</Button>
        <Button variant="ghost" nativeButton={false} render={<Link href="/relatorios" />}>
          Limpar
        </Button>
      </div>
    </form>
  );
}

const fieldClass = "h-9 min-w-0 rounded-lg border border-input bg-white px-2.5 text-sm";

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm">
      <span className="text-zinc-600">{label}</span>
      {children}
    </label>
  );
}

function ReportMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="workspace-surface rounded-lg p-4">
      <span className="text-sm font-medium text-zinc-500">{label}</span>
      <strong className="mt-1.5 block text-2xl font-bold tracking-tight text-zinc-950">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </strong>
    </div>
  );
}

function ReportTab({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      nativeButton={false}
      render={<Link href={href} />}
    >
      {children}
    </Button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-4 py-3">{children}</td>;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}min`;
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: ReportParams;
}) {
  function href(next: number) {
    const query = new URLSearchParams(
      Object.entries(params).filter((entry): entry is [string, string] =>
        Boolean(entry[1])
      )
    );
    query.set("page", String(next));
    return `/relatorios?${query.toString()}`;
  }
  return (
    <div className="flex items-center justify-between text-sm text-zinc-500">
      <span>Página {page} de {totalPages}</span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={href(page - 1)} />}
          >
            Anterior
          </Button>
        ) : (
          <Button variant="outline" disabled>
            Anterior
          </Button>
        )}
        {page < totalPages ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={href(page + 1)} />}
          >
            Próxima
          </Button>
        ) : (
          <Button variant="outline" disabled>
            Próxima
          </Button>
        )}
      </div>
    </div>
  );
}

function tabHref(params: ReportParams, tab: "operacao" | "empresas") {
  const query = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] =>
      Boolean(entry[1])
    )
  );
  query.set("tab", tab);
  query.delete("page");
  return `/relatorios?${query.toString()}`;
}
