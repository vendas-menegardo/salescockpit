"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Filter, Loader2, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COMPANY_FILTER_KEYS } from "../lib/company-search-params";

type Option = { value: string; label: string };

const quickViews = [
  ["all", "Todas"],
  ["contact-update", "Atualizar contato"],
  ["missing-phone", "Sem telefone"],
  ["missing-email", "Sem e-mail"],
  ["missing-responsible", "Sem responsável"],
  ["ready", "Prontas para operação"],
  ["pending-returns", "Retornos pendentes"],
] as const;

const filterLabels: Record<string, string> = {
  baseId: "Base",
  city: "Cidade",
  qualification: "Qualificação",
  stage: "Estágio",
  phoneStatus: "Telefone",
  whatsapp: "WhatsApp",
  emailStatus: "E-mail",
  responsible: "Responsável",
  operationStatus: "Situação operacional",
  lastInteractionFrom: "Interação desde",
  lastInteractionTo: "Interação até",
  updatedFrom: "Atualizada desde",
  updatedTo: "Atualizada até",
};

export function CompanyCentralFilters({
  bases,
  counts,
  globalContactUpdateCount,
  qualificationOptions,
  stageOptions,
}: {
  bases: Option[];
  counts: Record<string, number>;
  globalContactUpdateCount: number | null;
  qualificationOptions: Option[];
  stageOptions: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [filtersOpen, setFiltersOpen] = useState(
    COMPANY_FILTER_KEYS.some((key) => !["query", "quickView", "pageSize"].includes(key) && searchParams.has(key))
  );
  const initialQuery = useRef(query);

  function navigate(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    params.delete("page");
    params.delete("companyId");
    startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  }

  useEffect(() => {
    if (query === initialQuery.current) return;
    const timer = window.setTimeout(() => {
      navigate((params) => {
        if (query.trim()) params.set("query", query.trim());
        else params.delete("query");
      });
    }, 350);
    return () => window.clearTimeout(timer);
    // Navigation is intentionally driven only by the typed query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const activeFilters = COMPANY_FILTER_KEYS.filter(
    (key) => !["query", "quickView", "pageSize"].includes(key) && searchParams.has(key)
  );
  const currentView = searchParams.get("quickView") || "all";

  return (
    <section className="space-y-3" aria-label="Busca e filtros de empresas">
      <div className="flex gap-2 overflow-x-auto border-b border-zinc-200 pb-2" role="tablist" aria-label="Visualizações rápidas">
        {quickViews.map(([value, label]) => {
          const active = currentView === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => navigate((params) => value === "all" ? params.delete("quickView") : params.set("quickView", value))}
              className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transition-none ${active ? "border-blue-600 bg-blue-600 text-white" : value === "contact-update" ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"}`}
            >
              {label} <span className={active ? "text-blue-100" : "text-zinc-500"}>{counts[value]?.toLocaleString("pt-BR") ?? 0}</span>
            </button>
          );
        })}
      </div>

      {currentView === "contact-update" && searchParams.has("baseId") && globalContactUpdateCount !== null && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p>
            Exibindo {counts["contact-update"]?.toLocaleString("pt-BR") ?? 0} nesta base. No total, há{" "}
            <strong>{globalContactUpdateCount.toLocaleString("pt-BR")}</strong> empresas para atualizar contato.
          </p>
          <button
            type="button"
            onClick={() => navigate((params) => params.delete("baseId"))}
            className="font-semibold text-amber-950 underline decoration-amber-500 underline-offset-4 hover:text-amber-800 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
          >
            Ver todas as bases
          </button>
        </div>
      )}

      <div className="workspace-surface flex flex-col gap-2 rounded-lg p-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar empresas</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, CNPJ, telefone, e-mail ou responsável"
            className="h-10 bg-white pl-9 pr-9"
          />
          {pending ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-blue-600" /> : query ? (
            <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:bg-zinc-100" aria-label="Limpar busca"><X size={16} /></button>
          ) : null}
        </label>
        <Button type="button" variant="outline" onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen}>
          <Filter data-icon="inline-start" /> Filtros {activeFilters.length ? `(${activeFilters.length})` : ""}
        </Button>
        {(activeFilters.length > 0 || currentView !== "all" || query) && (
          <Button type="button" variant="ghost" onClick={() => { setQuery(""); startTransition(() => router.replace(pathname, { scroll: false })); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {filtersOpen && (
        <form
          className="workspace-surface grid gap-3 rounded-lg p-4 sm:grid-cols-2 lg:grid-cols-4"
          onChange={(event) => {
            const target = event.target as unknown as HTMLInputElement | HTMLSelectElement;
            if (!target.name) return;
            navigate((params) => target.value ? params.set(target.name, target.value) : params.delete(target.name));
          }}
        >
          <SelectFilter name="baseId" label="Base" value={searchParams.get("baseId") || ""} options={bases} />
          <TextFilter name="city" label="Cidade" value={searchParams.get("city") || ""} />
          <SelectFilter name="qualification" label="Qualificação" value={searchParams.get("qualification") || ""} options={qualificationOptions} />
          <SelectFilter name="stage" label="Estágio comercial" value={searchParams.get("stage") || ""} options={stageOptions} />
          <SelectFilter name="phoneStatus" label="Telefone" value={searchParams.get("phoneStatus") || ""} options={[{ value: "has", label: "Possui telefone" }, { value: "missing", label: "Sem telefone" }, { value: "invalid", label: "Marcado como inválido" }]} />
          <SelectFilter name="whatsapp" label="WhatsApp" value={searchParams.get("whatsapp") || ""} options={[{ value: "has", label: "Possui WhatsApp" }]} />
          <SelectFilter name="emailStatus" label="E-mail" value={searchParams.get("emailStatus") || ""} options={[{ value: "missing", label: "Sem e-mail" }]} />
          <SelectFilter name="responsible" label="Responsável" value={searchParams.get("responsible") || ""} options={[{ value: "has", label: "Possui responsável" }, { value: "missing", label: "Sem responsável" }]} />
          <SelectFilter name="operationStatus" label="Situação operacional" value={searchParams.get("operationStatus") || ""} options={[{ value: "not-worked", label: "Não trabalhada" }, { value: "worked", label: "Já trabalhada" }, { value: "pending-return", label: "Retorno pendente" }]} />
          <DateFilter name="lastInteractionFrom" label="Última interação desde" value={searchParams.get("lastInteractionFrom") || ""} />
          <DateFilter name="lastInteractionTo" label="Última interação até" value={searchParams.get("lastInteractionTo") || ""} />
          <DateFilter name="updatedFrom" label="Atualizada desde" value={searchParams.get("updatedFrom") || ""} />
          <DateFilter name="updatedTo" label="Atualizada até" value={searchParams.get("updatedTo") || ""} />
        </form>
      )}

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Filtros ativos">
          {activeFilters.map((key) => (
            <button key={key} type="button" onClick={() => navigate((params) => params.delete(key))} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <Check size={13} /> {filterLabels[key]} <X size={13} aria-hidden />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm"><span className="font-medium text-zinc-600">{label}</span>{children}</label>;
}
function SelectFilter({ name, label, value, options }: { name: string; label: string; value: string; options: Option[] }) {
  return <Field label={label}><select name={name} value={value} onChange={() => undefined} className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm"><option value="">Todos</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>;
}
function TextFilter({ name, label, value }: { name: string; label: string; value: string }) {
  return <Field label={label}><Input name={name} defaultValue={value} /></Field>;
}
function DateFilter({ name, label, value }: { name: string; label: string; value: string }) {
  return <Field label={label}><Input name={name} type="date" value={value} onChange={() => undefined} /></Field>;
}
