import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { BaseService } from "@/features/bases/services/base-service";
import { isAdminRole } from "@/features/auth/lib/access-control";
import { ActivateBaseButton } from "@/features/bases/components/activate-base-button";
import { DeleteBaseButton } from "@/features/bases/components/delete-base-button";
import { requireSession } from "@/lib/auth-session";
import { PageHeader } from "@/components/common/page-header";

export default async function BasesPage() {
  const session = await requireSession();
  const canManageBases = isAdminRole(session.user.role);
  const bases = await BaseService.findAll();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bases"
        description="Organize as carteiras comerciais e acompanhe o volume disponível para operação."
        actions={canManageBases ? (
          <Button
            nativeButton={false}
            render={<Link href="/bases/nova" />}
          >
            <Plus data-icon="inline-start" />
            Nova Base
          </Button>
        ) : undefined}
      />

      {bases.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            Nenhuma base cadastrada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {bases.map((base) => (
            <Card key={base.id}>
              <CardHeader className="flex flex-row items-start justify-between border-b border-zinc-100 pb-4">
                <div>
                  <CardTitle>{base.name}</CardTitle>

                  {base.description && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-zinc-500">
                      {base.description}
                    </p>
                  )}
                </div>

                {base.isActive && (
                  <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                    Ativa
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-zinc-500">Empresas</p><strong className="text-2xl text-zinc-950">{base.companiesCount.toLocaleString("pt-BR")}</strong></div>
                <div><p className="text-xs text-zinc-500">Localidade</p><strong>{[base.city, base.state].filter(Boolean).join("/") || "Todas"}</strong></div>
                <div className="col-span-2"><p className="text-xs text-zinc-500">Segmento</p><strong>{base.segment || "Todos os segmentos"}</strong></div>
              </CardContent>

              <CardFooter className="flex flex-wrap gap-2 bg-zinc-50/80">
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/bases/${base.id}`} />}
                >
                  Abrir
                  <ArrowRight data-icon="inline-end" />
                </Button>

                {canManageBases && (
                  <>
                    <Button
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/bases/${base.id}/editar`} />}
                    >
                      Editar
                    </Button>

                    {!base.isActive && (
                      <ActivateBaseButton baseId={base.id} />
                    )}

                    <DeleteBaseButton
                      baseId={base.id}
                      baseName={base.name}
                    />
                  </>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
