import { PageHeader } from "@/components/common/page-header";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { EmptyState } from "@/components/feedback/empty-state";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Configurações"
        description="Gerencie as preferências e configurações do SalesCockpit."
      />

      <DashboardSection title="Configurações gerais">
        <EmptyState
          title="Nenhuma configuração disponível"
          description="As opções de configuração serão exibidas aqui."
        />
      </DashboardSection>
    </div>
  );
}