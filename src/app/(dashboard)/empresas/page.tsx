import { PageHeader } from "@/components/common/page-header";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { EmptyState } from "@/components/feedback/empty-state";

export default function EmpresasPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Empresas"
        description="Visualize e gerencie as empresas das suas bases."
      />

      <DashboardSection title="Empresas cadastradas">
        <EmptyState
          title="Nenhuma empresa disponível"
          description="As empresas encontradas nas bases importadas serão exibidas aqui."
        />
      </DashboardSection>
    </div>
  );
}