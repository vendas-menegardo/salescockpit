import { Activity, CalendarClock, PhoneCall, Target, Users } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { AnalyticsService } from "@/features/analytics/services/analytics-service";
import { DashboardAutoRefresh } from "@/features/analytics/components/dashboard-auto-refresh";
import {
  defaultDateRange,
  type AnalyticsFilters,
} from "@/features/analytics/lib/report-filters";
import { isAdminRole } from "@/features/auth/lib/access-control";
import { COMMERCIAL_STAGE_LABELS } from "@/features/operation/constants";
import { requireSession } from "@/lib/auth-session";

type DashboardParams = {
  from?: string;
  to?: string;
  userId?: string;
  baseId?: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardParams>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const defaults = defaultDateRange();
  const admin = isAdminRole(session.user.role);
  const filters: AnalyticsFilters = {
    from: params.from || defaults.from,
    to: params.to || defaults.to,
    userId: admin ? params.userId : session.user.id,
    baseId: params.baseId,
  };
  const [metrics, options] = await Promise.all([
    AnalyticsService.getMetrics(
      filters,
      admin ? undefined : session.user.id
    ),
    AnalyticsService.getFilterOptions(admin),
  ]);

  const funnel = [
    ["Tentativas", metrics.attempts],
    ["Atendidas", metrics.answered],
    ["Responsável", metrics.responsibleConversations],
    ["Qualificadas", metrics.stageCounts.QUALIFICADA],
    ["Reuniões agendadas", metrics.stageCounts.REUNIAO_AGENDADA],
    ["Reuniões realizadas", metrics.stageCounts.REUNIAO_REALIZADA],
    ["Ganhas", metrics.stageCounts.GANHA],
  ] as const;
  const maxFunnel = Math.max(1, ...funnel.map((item) => item[1]));

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-full lg:overflow-hidden">
      <DashboardAutoRefresh />

      <div className="grid shrink-0 gap-3 xl:grid-cols-[minmax(13rem,0.7fr)_minmax(0,2fr)] xl:items-end">
        <PageHeader
          title="Dashboard"
          description="Acompanhamento da operação com dados reais do histórico comercial."
        />

        <form className="workspace-surface grid gap-2 rounded-lg p-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.1fr_1.2fr_auto]">
          <FilterField label="Data inicial">
            <input
              type="date"
              name="from"
              defaultValue={filters.from}
              className="h-8 min-w-0 rounded-lg border border-input bg-white px-2 text-sm"
            />
          </FilterField>
          <FilterField label="Data final">
            <input
              type="date"
              name="to"
              defaultValue={filters.to}
              className="h-8 min-w-0 rounded-lg border border-input bg-white px-2 text-sm"
            />
          </FilterField>
          {admin && (
            <FilterField label="Usuário">
              <select
                name="userId"
                defaultValue={filters.userId || ""}
                className="h-8 min-w-0 rounded-lg border border-input bg-white px-2 text-sm"
              >
                <option value="">Todos os usuários</option>
                {options.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </FilterField>
          )}
          <FilterField label="Base">
            <select
              name="baseId"
              defaultValue={filters.baseId || ""}
              className="h-8 min-w-0 rounded-lg border border-input bg-white px-2 text-sm"
            >
              <option value="">Todas as bases</option>
              {options.bases.map((base) => (
                <option key={base.id} value={base.id}>
                  {base.name}
                </option>
              ))}
            </select>
          </FilterField>
          <div className="flex items-end">
            <Button type="submit" size="sm">
              Atualizar
            </Button>
          </div>
        </form>
      </div>

      <section className="shrink-0 space-y-2">
        <h2 className="text-base font-semibold tracking-tight">
          Atividade no período
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            icon={PhoneCall}
            label="Tentativas"
            value={metrics.attempts}
          />
          <Metric
            icon={Users}
            label="Empresas trabalhadas"
            value={metrics.uniqueCompanies}
          />
          <Metric
            icon={Activity}
            label="Atendidas"
            value={metrics.answered}
          />
          <Metric
            icon={Target}
            label="Falou com responsável"
            value={metrics.responsibleConversations}
          />
          <Metric
            icon={CalendarClock}
            label="Retornos agendados"
            value={metrics.followUpsScheduled}
          />
        </div>
      </section>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.85fr)]">
        <section className="workspace-surface min-h-0 rounded-lg border-t-2 border-t-blue-600 p-4">
          <h2 className="text-base font-bold tracking-tight text-zinc-900">
            Funil comercial
          </h2>
          <div className="mt-2 space-y-1">
            {funnel.map(([label, value]) => (
              <div
                key={label}
                className="grid min-h-8 grid-cols-[9rem_1fr_3.5rem] items-center gap-2 text-sm"
              >
                <span>{label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${Math.max(2, (value / maxFunnel) * 100)}%` }}
                  />
                </div>
                <strong className="text-right">{value.toLocaleString("pt-BR")}</strong>
              </div>
            ))}
          </div>
        </section>

        <div className="grid min-h-0 content-start gap-3 xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden">
          <section className="workspace-surface rounded-lg p-3">
            <h2 className="text-base font-semibold tracking-tight">
              Pendências
            </h2>
            <dl className="mt-1 divide-y divide-zinc-100 text-sm">
              <StatLine label="Retornos pendentes" value={metrics.followUpsPending} />
              <StatLine label="Retornos atrasados" value={metrics.followUpsOverdue} />
              <StatLine label="Números invalidados" value={metrics.invalidNumbers} />
              <StatLine
                label={COMMERCIAL_STAGE_LABELS.CONGELADA}
                value={metrics.stageCounts.CONGELADA}
              />
            </dl>
          </section>

          <section className="workspace-surface min-h-0 rounded-lg p-3 xl:overflow-y-auto">
            <h2 className="text-base font-semibold tracking-tight">
              Qualidade dos dados
            </h2>
            <dl className="mt-1 grid gap-x-4 sm:grid-cols-2">
              <CompactMetric label="Contatos adicionados" value={metrics.contactsAdded} />
              <CompactMetric label="Contatos validados" value={metrics.contactsValidated} />
              <CompactMetric label="Telefones invalidados" value={metrics.contactsInvalidated} />
              <CompactMetric label="Empresas enriquecidas" value={metrics.enrichedCompanies} />
              <CompactMetric label="Com telefone" value={metrics.companiesWithPhone} />
              <CompactMetric label="Com e-mail" value={metrics.companiesWithEmail} />
              <CompactMetric label="Com site" value={metrics.companiesWithWebsite} />
              <CompactMetric label="Com rede social" value={metrics.companiesWithSocial} />
            </dl>
            {metrics.enrichedCompanies > 0 && (
              <p className="mt-2 text-xs text-zinc-500">
                Completude média: {metrics.completenessBefore}% para{" "}
                {metrics.completenessAfter}%.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-xs">
      <span className="truncate text-zinc-600">{label}</span>
      {children}
    </label>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Activity;
  label: string;
  value: number;
}) {
  return (
    <div className="workspace-surface rounded-lg p-3">
      <div className="flex items-center justify-between gap-3 text-sm text-zinc-500">
        <span className="font-medium">{label}</span>
        {Icon && <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600"><Icon size={16} aria-hidden="true" /></span>}
      </div>
      <strong className="mt-1 block text-2xl font-bold tracking-tight text-zinc-950">
        {value.toLocaleString("pt-BR")}
      </strong>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 py-1">
      <dt>{label}</dt>
      <dd className="font-semibold">{value.toLocaleString("pt-BR")}</dd>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2 border-b border-zinc-100 py-1 text-sm">
      <dt className="text-zinc-600">{label}</dt>
      <dd className="font-semibold">{value.toLocaleString("pt-BR")}</dd>
    </div>
  );
}
