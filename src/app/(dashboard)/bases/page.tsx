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

export default async function BasesPage() {
  const session = await requireSession();
  const canManageBases = isAdminRole(session.user.role);
  const bases = await BaseService.findAll();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bases</h1>

          <p className="text-muted-foreground">
            Gerencie suas bases comerciais.
          </p>
        </div>

        {canManageBases && (
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/bases/nova" />}
          >
            <Plus data-icon="inline-start" />
            Nova Base
          </Button>
        )}
      </div>

      {bases.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            Nenhuma base cadastrada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5">
          {bases.map((base) => (
            <Card key={base.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{base.name}</CardTitle>

                  {base.description && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {base.description}
                    </p>
                  )}
                </div>

                {base.isActive && (
                  <Badge>
                    Ativa
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="grid gap-2 text-sm">
                <p>
                  <strong>Segmento:</strong> {base.segment || "-"}
                </p>

                <p>
                  <strong>Estado:</strong> {base.state || "-"}
                </p>

                <p>
                  <strong>Cidade:</strong> {base.city || "-"}
                </p>

                <p>
                  <strong>Empresas:</strong> {base.companiesCount}
                </p>
              </CardContent>

              <CardFooter className="flex gap-2">
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
