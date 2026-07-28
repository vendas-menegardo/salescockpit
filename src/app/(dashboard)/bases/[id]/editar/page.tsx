import { notFound } from "next/navigation";

import { BaseService } from "@/features/bases/services/base-service";
import { EditBaseForm } from "@/features/bases/components/edit-base-form";
import { requireAdmin } from "@/lib/auth-session";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditarBasePage({ params }: Props) {
  await requireAdmin();

  const { id } = await params;

  const base = await BaseService.findById(id);

  if (!base) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Editar Base
        </h1>

        <p className="text-muted-foreground">
          Atualize as informações da base.
        </p>
      </div>

      <EditBaseForm base={base} />
    </div>
  );
}
