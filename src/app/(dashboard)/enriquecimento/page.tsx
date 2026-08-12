import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BaseService } from "@/features/bases/services/base-service";
import { getCompanyDisplayName } from "@/features/companies/lib/company-display-name";
import { EnrichmentReviewPanel } from "@/features/enrichment/components/enrichment-review-panel";
import { EnrichmentService, type EnrichmentQueueFilter } from "@/features/enrichment/services/enrichment-service";
import { formatCnpj } from "@/features/import/lib/import-utils";

type Params = { baseId?: string; query?: string; filter?: string; page?: string; companyId?: string };
const filterLabels: Record<EnrichmentQueueFilter, string> = { pending: "Todos pendentes", "missing-phone": "Sem telefone", "missing-email": "Sem e-mail", "missing-responsible": "Sem responsável" };

function href(params: Params, changes: Partial<Params>) {
  const next = new URLSearchParams();
  Object.entries({ ...params, ...changes }).forEach(([key, value]) => { if (value) next.set(key, value); });
  return `/enriquecimento?${next.toString()}`;
}

export default async function EnrichmentPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filter = Object.keys(filterLabels).includes(params.filter || "") ? params.filter as EnrichmentQueueFilter : "pending";
  const page = Number.parseInt(params.page || "1", 10) || 1;
  const [queue, overview, bases] = await Promise.all([
    EnrichmentService.getQueue({ baseId: params.baseId, query: params.query, filter, page }),
    EnrichmentService.getOverview(params.baseId),
    BaseService.findAll(),
  ]);
  const selected = params.companyId ? await EnrichmentService.getCompany(params.companyId) : queue.companies[0] || null;
  const selectedInQueue = selected && selected.bases.some((item) => item.qualification === "ATUALIZAR_CONTATO" && (!params.baseId || item.baseId === params.baseId));

  return (
    <div className="space-y-5">
      <PageHeader title="Enriquecimento de contatos" description="Revise dados encontrados, valide contatos e devolva empresas prontas para a operação." actions={<Badge variant="outline">{overview.pending.toLocaleString("pt-BR")} pendentes</Badge>} />
      <section className="workspace-surface rounded-lg p-4">
        <form className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_minmax(14rem,20rem)_auto]">
          <label className="relative"><span className="sr-only">Pesquisar empresa</span><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-zinc-400" /><Input name="query" defaultValue={params.query} className="pl-9" placeholder="Empresa ou CNPJ" /></label>
          <label><span className="sr-only">Filtrar por base</span><select name="baseId" defaultValue={params.baseId || ""} className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm"><option value="">Todas as bases</option>{bases.map((base) => <option key={base.id} value={base.id}>{base.name}</option>)}</select></label>
          <Button type="submit">Filtrar</Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">{Object.entries(filterLabels).map(([value, label]) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} nativeButton={false} render={<Link href={href(params, { filter: value, page: undefined, companyId: undefined })} />}>{label} <span className="ml-1 opacity-70">{overview[value as EnrichmentQueueFilter]}</span></Button>)}</div>
      </section>

      <div className="grid min-h-[32rem] gap-4 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(34rem,1.4fr)]">
        <section className="workspace-surface overflow-hidden rounded-lg">
          <div className="border-b border-zinc-200 px-4 py-3"><h2 className="font-semibold">Fila de revisão</h2><p className="text-xs text-zinc-500">{queue.total.toLocaleString("pt-BR")} empresa{queue.total === 1 ? "" : "s"}</p></div>
          <div className="max-h-[62dvh] divide-y divide-zinc-100 overflow-y-auto">
            {queue.companies.map((company) => {
              const active = selected?.id === company.id;
              const valid = company.contacts.filter((contact) => contact.validity === "VALID" && !contact.archivedAt).length;
              return <Link key={company.id} href={href(params, { companyId: company.id })} scroll={false} className={`block px-4 py-3 outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-500 ${active ? "bg-blue-50" : ""}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm">{getCompanyDisplayName(company)}</strong><p className="mt-1 font-mono text-xs text-zinc-500">{formatCnpj(company.cnpj)}</p><p className="mt-1 text-xs text-zinc-500">{[company.city, company.state].filter(Boolean).join("/") || "Localidade não informada"}</p></div><Badge variant={valid ? "secondary" : "outline"}>{valid ? `${valid} válido${valid === 1 ? "" : "s"}` : "Revisar"}</Badge></div></Link>;
            })}
            {queue.companies.length === 0 && <div className="grid place-items-center gap-2 px-6 py-12 text-center"><Sparkles className="size-7 text-zinc-300" /><strong>Fila vazia</strong><p className="text-sm text-zinc-500">Não há empresas para este filtro.</p></div>}
          </div>
          <div className="flex items-center justify-between border-t border-zinc-200 p-3 text-xs text-zinc-500"><span>Página {queue.page} de {queue.totalPages}</span><div className="flex gap-2">{queue.page > 1 && <Button size="sm" variant="outline" nativeButton={false} render={<Link href={href(params, { page: String(queue.page - 1), companyId: undefined })} />}><ChevronLeft /></Button>}{queue.page < queue.totalPages && <Button size="sm" variant="outline" nativeButton={false} render={<Link href={href(params, { page: String(queue.page + 1), companyId: undefined })} />}><ChevronRight /></Button>}</div></div>
        </section>

        <section className="workspace-surface rounded-lg p-5">
          {selected && selectedInQueue ? <><div className="mb-5 border-b border-zinc-200 pb-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-zinc-950">{getCompanyDisplayName(selected)}</h2><p className="mt-1 font-mono text-xs text-zinc-500">{formatCnpj(selected.cnpj)} · {[selected.city, selected.state].filter(Boolean).join("/") || "Localidade não informada"}</p></div><Button variant="outline" nativeButton={false} render={<Link href={`/empresas/${selected.id}`} />}>Abrir dossiê</Button></div><div className="mt-3 flex flex-wrap gap-2">{selected.bases.filter((item) => item.qualification === "ATUALIZAR_CONTATO").map((item) => <Badge key={item.baseId} variant="outline">{item.base.name}</Badge>)}</div></div><EnrichmentReviewPanel companyId={selected.id} contacts={selected.contacts} memberships={selected.bases.map((item) => ({ baseId: item.baseId, baseName: item.base.name, qualification: item.qualification }))} /></> : <div className="grid min-h-80 place-items-center text-center"><div><Sparkles className="mx-auto size-8 text-zinc-300" /><h2 className="mt-3 font-semibold">Selecione uma empresa</h2><p className="mt-1 text-sm text-zinc-500">Escolha um item da fila para revisar os contatos.</p></div></div>}
        </section>
      </div>
    </div>
  );
}
