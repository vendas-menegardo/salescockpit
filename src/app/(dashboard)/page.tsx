import { Activity, CalendarClock, PhoneCall, Target, Users } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
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
    <div className="space-y-7">
      <DashboardAutoRefresh />
      <PageHeader
        title="Dashboard"
        description="Acompanhamento da operação com dados reais do histórico comercial."
      />

      <form className="grid gap-3 border-y border-zinc-200 py-4 sm:grid-cols-2 xl:grid-cols-5">
        <FilterField label="Data inicial">
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm"
          />
        </FilterField>
        <FilterField label="Data final">
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm"
          />
        </FilterField>
        {admin && (
          <FilterField label="Usuário">
            <select
              name="userId"
              defaultValue={filters.userId || ""}
              className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm"
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
            className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm"
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
          <Button type="submit">Atualizar</Button>
        </div>
      </form>

      <DashboardSection title="Atividade no período">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
      </DashboardSection>

      <div className="grid gap-7 xl:grid-cols-[1.4fr_1fr]">
        <DashboardSection title="Funil comercial">
          <div className="space-y-3 border-y border-zinc-200 py-4">
            {funnel.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[10rem_1fr_4rem] items-center gap-3 text-sm">
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
        </DashboardSection>

        <DashboardSection title="Pendências">
          <dl className="divide-y divide-zinc-200 border-y border-zinc-200 text-sm">
            <StatLine label="Retornos pendentes" value={metrics.followUpsPending} />
            <StatLine label="Retornos atrasados" value={metrics.followUpsOverdue} />
            <StatLine label="Números invalidados" value={metrics.invalidNumbers} />
            <StatLine
              label={COMMERCIAL_STAGE_LABELS.CONGELADA}
              value={metrics.stageCounts.CONGELADA}
            />
          </dl>
        </DashboardSection>
      </div>

      <DashboardSection title="Qualidade dos dados">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Contatos adicionados" value={metrics.contactsAdded} />
          <Metric label="Contatos validados" value={metrics.contactsValidated} />
          <Metric label="Telefones invalidados" value={metrics.contactsInvalidated} />
          <Metric label="Empresas enriquecidas" value={metrics.enrichedCompanies} />
          <Metric label="Empresas com telefone" value={metrics.companiesWithPhone} />
          <Metric label="Empresas com e-mail" value={metrics.companiesWithEmail} />
          <Metric label="Empresas com site" value={metrics.companiesWithWebsite} />
          <Metric label="Empresas com rede social" value={metrics.companiesWithSocial} />
        </div>
        {metrics.enrichedCompanies > 0 && (
          <p className="text-sm text-zinc-500">
            Completude média registrada: {metrics.completenessBefore}% para{" "}
            {metrics.completenessAfter}%.
          </p>
        )}
      </DashboardSection>
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
    <label className="grid gap-1 text-sm">
      <span className="text-zinc-600">{label}</span>
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
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3 text-sm text-zinc-500">
        <span>{label}</span>
        {Icon && <Icon size={17} aria-hidden="true" />}
      </div>
      <strong className="mt-2 block text-2xl">
        {value.toLocaleString("pt-BR")}
      </strong>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt>{label}</dt>
      <dd className="font-semibold">{value.toLocaleString("pt-BR")}</dd>
    </div>
  );
}
