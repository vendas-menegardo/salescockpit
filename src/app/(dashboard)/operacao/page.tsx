import { PageHeader } from "@/components/common/page-header";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { EmptyState } from "@/components/feedback/empty-state";

export default function OperacaoPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Operação"
        description="Execute as ações comerciais da base ativa."
      />

      <DashboardSection title="Fila de trabalho">
        <EmptyState
          title="Operação ainda não disponível"
          description="As empresas da base ativa serão apresentadas aqui em uma etapa futura."
        />
      </DashboardSection>
    </div>
  );
}
