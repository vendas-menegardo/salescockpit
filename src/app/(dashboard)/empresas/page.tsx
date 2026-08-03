import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BaseService } from "@/features/bases/services/base-service";
import { CompanyService } from "@/features/companies/services/company-service";
import { formatCnpj } from "@/features/import/lib/import-utils";

type EmpresasPageProps = {
  searchParams: Promise<{
    query?: string;
    baseId?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function EmpresasPage({
  searchParams,
}: EmpresasPageProps) {
  const {
    query = "",
    baseId = "",
    page: pageParam = "1",
    pageSize: pageSizeParam = "25",
  } = await searchParams;
  const requestedPage = Number.parseInt(pageParam, 10);
  const requestedPageSize = Number.parseInt(pageSizeParam, 10);
  const pageSize = [25, 50, 100].includes(requestedPageSize)
    ? requestedPageSize
    : 25;
  const resultPromise = CompanyService.findPage({
    query,
    baseId,
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
    pageSize,
  });
  const [result, selectedBase] = await Promise.all([
    resultPromise,
    baseId ? BaseService.findById(baseId) : null,
  ]);
  const { companies, total, page, totalPages } = result;

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (baseId) params.set("baseId", baseId);
    params.set("pageSize", String(pageSize));
    params.set("page", String(nextPage));
    return `/empresas?${params.toString()}`;
  }
  const returnTo = pageHref(page);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas"
        description={
          selectedBase
            ? `Empresas vinculadas à base ${selectedBase.name}.`
            : "Consulte o cadastro central de empresas."
        }
      />

      <form className="flex max-w-2xl flex-col gap-2 sm:flex-row">
        {baseId && <input type="hidden" name="baseId" value={baseId} />}
        <div className="relative min-w-0 flex-1">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
            size={16}
          />
          <Input
            name="query"
            defaultValue={query}
            placeholder="CNPJ, razão social ou nome fantasia"
            className="pl-8"
          />
        </div>
        <select
          name="pageSize"
          defaultValue={String(pageSize)}
          aria-label="Itens por página"
          className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm"
        >
          <option value="25">25 por página</option>
          <option value="50">50 por página</option>
          <option value="100">100 por página</option>
        </select>
        <Button type="submit">Pesquisar</Button>
        {(query || baseId) && (
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/empresas" />}
          >
            Limpar
          </Button>
        )}
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {companies.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-500">
            Nenhuma empresa encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                  <tr>
                  <th className="px-4 py-3 text-left font-medium">CNPJ</th>
                  <th className="px-4 py-3 text-left font-medium">Empresa</th>
                  <th className="px-4 py-3 text-left font-medium">Segmento</th>
                  <th className="px-4 py-3 text-left font-medium">Cidade/UF</th>
                  <th className="px-4 py-3 text-left font-medium">Contato</th>
                  <th className="px-4 py-3 text-left font-medium">Bases</th>
                  <th className="px-4 py-3 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {companies.map((company) => {
                  const operationMembership =
                    company.bases.find(
                      (membership) =>
                        membership.baseId === baseId && membership.base.isActive
                    ) ??
                    company.bases.find((membership) => membership.base.isActive);
                  return (
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
                    <td className="px-4 py-3">{company.segment || "-"}</td>
                    <td className="px-4 py-3">
                      {[company.city, company.state].filter(Boolean).join("/") ||
                        "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div>{company.phone || "-"}</div>
                      {company.email && (
                        <div className="max-w-56 truncate text-xs text-zinc-500">
                          {company.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {company.bases.length === 0
                          ? "-"
                          : company.bases.map((membership) => (
                              <Badge key={membership.baseId} variant="secondary">
                                {membership.base.name}
                              </Badge>
                            ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                      {operationMembership && (
                        <Button
                          size="sm"
                          nativeButton={false}
                          render={
                            <Link
                              href={`/operacao?baseId=${operationMembership.baseId}&companyId=${company.id}&returnTo=${encodeURIComponent(returnTo)}`}
                            />
                          }
                        >
                          Operação
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/empresas/${company.id}`} />}
                      >
                        Abrir
                      </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
        <p>
          {total === 0
            ? "Nenhum resultado"
            : `${total.toLocaleString("pt-BR")} empresa${total === 1 ? "" : "s"} · página ${page} de ${totalPages}`}
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={pageHref(page - 1)} />}
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
          {page < totalPages ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={pageHref(page + 1)} />}
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
    </div>
  );
}
