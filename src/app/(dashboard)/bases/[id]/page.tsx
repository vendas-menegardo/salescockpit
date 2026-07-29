import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BaseService } from "@/features/bases/services/base-service";
import { formatCnpj } from "@/features/import/lib/import-utils";
import { isAdminRole } from "@/features/auth/lib/access-control";
import { requireSession } from "@/lib/auth-session";

type BaseDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{ page?: string }>;
};

export default async function BaseDetailsPage({
  params,
  searchParams,
}: BaseDetailsPageProps) {
  const session = await requireSession();
  const canManageBases = isAdminRole(session.user.role);
  const { id } = await params;
  const { page: pageParam = "1" } = await searchParams;
  const requestedPage = Number.parseInt(pageParam, 10);
  const base = await BaseService.findByIdWithCompanies(
    id,
    Number.isFinite(requestedPage) ? requestedPage : 1
  );

  if (!base) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            className="mb-2 -ml-2"
            nativeButton={false}
            render={<Link href="/bases" />}
          >
            <ArrowLeft data-icon="inline-start" />
            Bases
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{base.name}</h1>
            {base.isActive && <Badge>Ativa</Badge>}
          </div>
          {base.description && (
            <p className="mt-2 text-muted-foreground">{base.description}</p>
          )}
        </div>

        <div className="flex gap-2">
          {canManageBases && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/bases/${base.id}/editar`} />}
            >
              Editar
            </Button>
          )}
          <Button
            nativeButton={false}
            render={<Link href={`/empresas?baseId=${base.id}`} />}
          >
            Ver em Empresas
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Building2 className="text-zinc-500" size={20} />
        <h2 className="text-lg font-semibold">
          Empresas vinculadas ({base.totalCompanies.toLocaleString("pt-BR")})
        </h2>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {base.companies.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-500">
            Esta base ainda não possui empresas vinculadas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">CNPJ</th>
                  <th className="px-4 py-3 text-left font-medium">Empresa</th>
                  <th className="px-4 py-3 text-left font-medium">Cidade/UF</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {base.companies.map(({ company, status, stage }) => (
                  <tr key={company.id}>
                    <td className="px-4 py-3 font-mono text-xs">
                      {formatCnpj(company.cnpj)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{company.corporateName}</div>
                      {company.tradeName && (
                        <div className="text-xs text-zinc-500">
                          {company.tradeName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {[company.city, company.state].filter(Boolean).join("/") ||
                        "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {stage === "NOVA" ? status || "Novo" : stage}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {base.page > 1 ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/bases/${base.id}?page=${base.page - 1}`} />}
          >
            <ChevronLeft data-icon="inline-start" />
            Anterior
          </Button>
        ) : (
          <Button variant="outline" disabled>
            <ChevronLeft data-icon="inline-start" />
            Anterior
          </Button>
        )}
        <span className="text-sm text-zinc-500">
          Página {base.page} de {base.totalPages}
        </span>
        {base.page < base.totalPages ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/bases/${base.id}?page=${base.page + 1}`} />}
          >
            Próxima
            <ChevronRight data-icon="inline-end" />
          </Button>
        ) : (
          <Button variant="outline" disabled>
            Próxima
            <ChevronRight data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  );
}
