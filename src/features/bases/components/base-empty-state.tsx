import { EmptyState } from "@/components/feedback/empty-state";

export function BaseEmptyState() {
  return (
    <EmptyState
      title="Nenhuma base cadastrada"
      description="Crie sua primeira base para começar a importar empresas."
    />
  );
}
