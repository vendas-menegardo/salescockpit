import { PageHeader } from "@/components/common/page-header";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { EmptyState } from "@/components/feedback/empty-state";

export default function RelatoriosPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Relatórios"
        description="Consulte o histórico das ações realizadas na operação."
      />

      <DashboardSection title="Histórico operacional">
        <EmptyState
          title="Relatórios ainda não disponíveis"
          description="Os filtros, resultados e exportações serão adicionados em uma etapa futura."
        />
      </DashboardSection>
    </div>
  );
}
