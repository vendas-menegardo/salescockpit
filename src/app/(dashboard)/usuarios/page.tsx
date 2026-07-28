import { PageHeader } from "@/components/common/page-header";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { EmptyState } from "@/components/feedback/empty-state";

export default function UsuariosPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Usuários"
        description="Administre usuários, perfis e acessos ao SaleCockpit."
      />

      <DashboardSection title="Administração de usuários">
        <EmptyState
          title="Gestão de usuários ainda não disponível"
          description="Os controles de acesso serão adicionados junto com a autenticação em uma etapa futura."
        />
      </DashboardSection>
    </div>
  );
}
