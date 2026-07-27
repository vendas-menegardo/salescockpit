import Link from "next/link";

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
import { setActiveBase } from "@/features/bases/actions/set-active-base";
import { deleteBase } from "@/features/bases/actions/delete-base";

export default async function BasesPage() {
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

        <Link href="/bases/nova">
          <Button>Nova Base</Button>
        </Link>
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
                <Link href={`/bases/${base.id}/editar`}>
                  <Button variant="outline">
                    Editar
                  </Button>
                </Link>

                {!base.isActive && (
                  <form action={setActiveBase.bind(null, base.id)}>
                    <Button>
                      Ativar
                    </Button>
                  </form>
                )}

                <form action={deleteBase.bind(null, base.id)}>
                  <Button variant="destructive">
                    Excluir
                  </Button>
                </form>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}