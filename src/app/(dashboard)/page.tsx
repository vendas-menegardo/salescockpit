import { PageHeader } from "@/components/common/page-header";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { EmptyState } from "@/components/feedback/empty-state";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Visão geral do SalesCockpit."
      />

      <DashboardSection title="Visão geral">
        <EmptyState
          title="Nenhuma informação disponível"
          description="À medida que você importar bases e utilizar o SalesCockpit, as informações do dashboard serão exibidas aqui."
        />
      </DashboardSection>
    </div>
  );
}

