import { PageHeader } from "@/components/common/page-header";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { EmptyState } from "@/components/feedback/empty-state";

export default function BuscaPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Busca"
        description="Encontre empresas e informações nas bases importadas."
      />

      <DashboardSection title="Resultados">
        <EmptyState
          title="Nenhuma busca realizada"
          description="Utilize os filtros de busca para encontrar empresas nas suas bases."
        />
      </DashboardSection>
    </div>
  );
}