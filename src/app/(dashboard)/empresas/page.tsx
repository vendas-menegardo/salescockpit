import Link from "next/link";
import { Search } from "lucide-react";

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
  }>;
};

export default async function EmpresasPage({
  searchParams,
}: EmpresasPageProps) {
  const { query = "", baseId = "" } = await searchParams;
  const [companies, selectedBase] = await Promise.all([
    CompanyService.findAll({ query, baseId }),
    baseId ? BaseService.findById(baseId) : null,
  ]);

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
                  <th className="px-4 py-3 text-left font-medium">Cidade/UF</th>
                  <th className="px-4 py-3 text-left font-medium">Bases</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {companies.map((company) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {companies.length === 100 && (
        <p className="text-xs text-zinc-500">
          Exibindo os primeiros 100 resultados. Refine a pesquisa para reduzir a
          lista.
        </p>
      )}
    </div>
  );
}
