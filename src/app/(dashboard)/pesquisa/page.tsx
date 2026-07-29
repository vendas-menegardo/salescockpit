import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { BaseService } from "@/features/bases/services/base-service";
import { isAdminRole } from "@/features/auth/lib/access-control";
import { calculateCompanyCompleteness } from "@/features/companies/lib/company-completeness";
import { CompanyService } from "@/features/companies/services/company-service";
import {
  SearchResults,
  type SearchCompanyRow,
} from "@/features/enrichment/components/search-results";
import { EnrichmentService } from "@/features/enrichment/services/enrichment-service";
import { formatCnpj } from "@/features/import/lib/import-utils";
import { requireSession } from "@/lib/auth-session";

type SearchParams = {
  query?: string;
  baseId?: string;
  city?: string;
  state?: string;
  segment?: string;
  completeness?:
    | "all"
    | "incomplete"
    | "missing-phone"
    | "missing-email"
    | "missing-site";
  page?: string;
};

export default async function PesquisaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const [result, bases, jobs] = await Promise.all([
    CompanyService.findPage({ ...params, page, pageSize: 25 }),
    BaseService.findAll(),
    EnrichmentService.getRecentJobs(
      session.user.id,
      isAdminRole(session.user.role)
    ),
  ]);
  const companies: SearchCompanyRow[] = result.companies.map((company) => ({
    id: company.id,
    cnpj: formatCnpj(company.cnpj),
    corporateName: company.corporateName,
    tradeName: company.tradeName,
    segment: company.segment,
    cityState: [company.city, company.state].filter(Boolean).join("/") || "-",
    completeness: calculateCompanyCompleteness({
      ...company,
      contactCount: company.contacts.length,
    }),
    bases: company.bases.map((membership) => membership.base.name),
  }));

  return (
    <div className="space-y-7">
      <PageHeader
        title="Pesquisa"
        description="Localize empresas existentes e identifique dossiês que precisam de enriquecimento."
      />
      <form className="grid gap-3 border-y border-zinc-200 py-4 md:grid-cols-3 xl:grid-cols-6">
        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="text-zinc-600">Empresa ou CNPJ</span>
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
              size={16}
            />
            <input
              name="query"
              defaultValue={params.query}
              className={`${fieldClass} w-full pl-8`}
            />
          </div>
        </label>
        <Filter label="Base">
          <select
            name="baseId"
            defaultValue={params.baseId || ""}
            className={fieldClass}
          >
            <option value="">Todas</option>
            {bases.map((base) => (
              <option key={base.id} value={base.id}>
                {base.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Cidade">
          <input
            name="city"
            defaultValue={params.city}
            className={fieldClass}
          />
        </Filter>
        <Filter label="UF">
          <input
            name="state"
            defaultValue={params.state}
            maxLength={2}
            className={fieldClass}
          />
        </Filter>
        <Filter label="Segmento">
          <input
            name="segment"
            defaultValue={params.segment}
            className={fieldClass}
          />
        </Filter>
        <Filter label="Completude">
          <select
            name="completeness"
            defaultValue={params.completeness || "all"}
            className={fieldClass}
          >
            <option value="all">Todas</option>
            <option value="incomplete">Dossiê incompleto</option>
            <option value="missing-phone">Sem telefone</option>
            <option value="missing-email">Sem e-mail</option>
            <option value="missing-site">Sem site</option>
          </select>
        </Filter>
        <div className="flex items-end gap-2">
          <Button type="submit">Pesquisar</Button>
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/pesquisa" />}
          >
            Limpar
          </Button>
        </div>
      </form>

      <div>
        <h2 className="text-lg font-semibold">Resultados</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {result.total.toLocaleString("pt-BR")} empresa
          {result.total === 1 ? "" : "s"} encontrada
          {result.total === 1 ? "" : "s"}.
        </p>
      </div>
      <SearchResults
        companies={companies}
        providerConfigured={EnrichmentService.isProviderConfigured()}
      />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        params={params}
      />

      <section className="space-y-3 border-t border-zinc-200 pt-5">
        <h2 className="text-lg font-semibold">Enriquecimentos recentes</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nenhum job de enriquecimento registrado.
          </p>
        ) : (
          <div className="divide-y divide-zinc-200 border-y border-zinc-200 text-sm">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap justify-between gap-2 py-3"
              >
                <span>
                  {job.provider} · {job.user.name}
                </span>
                <span>
                  {job.status} · {job.processed}/{job.totalItems}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const fieldClass =
  "h-9 min-w-0 rounded-lg border border-input bg-white px-2.5 text-sm";

function Filter({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-sm">
      <span className="text-zinc-600">{label}</span>
      {children}
    </label>
  );
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: SearchParams;
}) {
  function href(nextPage: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(nextPage));
    return `/pesquisa?${query.toString()}`;
  }
  return (
    <div className="flex items-center justify-between text-sm text-zinc-500">
      <span>
        Página {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={href(page - 1)} />}
          >
            <ChevronLeft data-icon="inline-start" /> Anterior
          </Button>
        ) : (
          <Button variant="outline" disabled>
            <ChevronLeft data-icon="inline-start" /> Anterior
          </Button>
        )}
        {page < totalPages ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={href(page + 1)} />}
          >
            Próxima <ChevronRight data-icon="inline-end" />
          </Button>
        ) : (
          <Button variant="outline" disabled>
            Próxima <ChevronRight data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  );
}
