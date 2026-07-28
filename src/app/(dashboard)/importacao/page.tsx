import { BaseService } from "@/features/bases/services/base-service";
import { ImportCompaniesView } from "@/features/import/components/import-companies-view";

export default async function ImportacaoPage() {
  const bases = await BaseService.findAll();

  return (
    <ImportCompaniesView
      initialBases={bases.map((base) => ({
        id: base.id,
        name: base.name,
        description: base.description,
      }))}
    />
  );
}
