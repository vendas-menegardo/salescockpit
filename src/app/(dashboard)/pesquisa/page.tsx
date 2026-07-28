import { PageHeader } from "@/components/common/page-header";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { EmptyState } from "@/components/feedback/empty-state";

export default function PesquisaPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Pesquisa"
        description="Valide, enriqueça e qualifique os dados das empresas."
      />

      <DashboardSection title="Pesquisa de empresas">
        <EmptyState
          title="Pesquisa ainda não disponível"
          description="As ferramentas de pesquisa e qualificação serão adicionadas em uma etapa futura."
        />
      </DashboardSection>
    </div>
  );
}
