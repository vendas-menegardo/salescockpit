import {
  CommercialStage,
  CompanyQualification,
} from "@prisma/client";
import Link from "next/link";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  PhoneCall,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BaseService } from "@/features/bases/services/base-service";
import { AddContactForm } from "@/features/companies/components/add-contact-form";
import { CompanyCentralFilters } from "@/features/companies/components/company-central-filters";
import { CompanyDossierSheet } from "@/features/companies/components/company-dossier-sheet";
import { CompanyPageSizeSelect } from "@/features/companies/components/company-page-size-select";
import { EditCompanyProfileForm } from "@/features/companies/components/edit-company-profile-form";
import { OperationContactPanel } from "@/features/operation/components/operation-contact-panel";
import { updateCompanyQualification } from "@/features/operation/actions/operation-actions";
import {
  getCompanyDisplayName,
  getCompanySecondaryName,
} from "@/features/companies/lib/company-display-name";
import {
  companyListUrl,
  operationReturnUrl,
} from "@/features/companies/lib/company-search-params";
import {
  type CompanyQuickView,
  CompanyService,
  type FindCompaniesInput,
} from "@/features/companies/services/company-service";
import {
  COMMERCIAL_STAGE_LABELS,
  CONTACT_TYPE_LABELS,
  CONTACT_VALIDITY_LABELS,
  INTERACTION_RESULT_LABELS,
} from "@/features/operation/constants";
import { formatCnpj } from "@/features/import/lib/import-utils";

type RawParams = Record<string, string | string[] | undefined>;

const qualificationLabels: Record<CompanyQualification, string> = {
  EM_OPERACAO: "Em operação",
  ATUALIZAR_CONTATO: "Atualizar contato",
  CONGELADA: "Congelada",
  PERDIDA: "Perdida",
  INAPTA: "Inapta",
};

function enumParam<T extends string>(value: string | undefined, values: readonly T[]) {
  return value && values.includes(value as T) ? (value as T) : undefined;
}

export default async function EmpresasPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const raw = await searchParams;
  const values = Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
  const requestedPage = Number.parseInt(values.page || "1", 10);
  const requestedPageSize = Number.parseInt(values.pageSize || "25", 10);
  const pageSize = [25, 50, 100].includes(requestedPageSize) ? requestedPageSize : 25;
  const quickViews: CompanyQuickView[] = ["all", "contact-update", "missing-phone", "missing-email", "missing-responsible", "ready", "pending-returns"];
  const input: FindCompaniesInput = {
    query: values.query,
    baseId: values.baseId,
    city: values.city,
    qualification: enumParam(values.qualification, Object.values(CompanyQualification)),
    stage: enumParam(values.stage, Object.values(CommercialStage)),
    phoneStatus: enumParam(values.phoneStatus, ["has", "missing", "invalid"] as const),
    whatsapp: enumParam(values.whatsapp, ["has"] as const),
    emailStatus: enumParam(values.emailStatus, ["missing"] as const),
    responsible: enumParam(values.responsible, ["has", "missing"] as const),
    operationStatus: enumParam(values.operationStatus, ["not-worked", "worked", "pending-return"] as const),
    lastInteractionFrom: values.lastInteractionFrom,
    lastInteractionTo: values.lastInteractionTo,
    updatedFrom: values.updatedFrom,
    updatedTo: values.updatedTo,
    quickView: enumParam(values.quickView, quickViews),
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
    pageSize,
  };
  const [result, bases, counts, globalContactUpdateCount, selectedCompany] = await Promise.all([
    CompanyService.findPage(input),
    BaseService.findAll(),
    CompanyService.countQuickViews(values.baseId),
    values.baseId
      ? CompanyService.countQuickView("contact-update")
      : Promise.resolve(null),
    values.companyId ? CompanyService.findById(values.companyId) : null,
  ]);
  const returnTo = operationReturnUrl({ ...values, page: String(result.page) });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Central de Empresas"
        description="Pesquise, filtre e atualize manualmente o cadastro comercial."
        actions={<p className="hidden text-sm text-zinc-500 sm:block">{result.total.toLocaleString("pt-BR")} resultado{result.total === 1 ? "" : "s"}</p>}
      />

      <CompanyCentralFilters
        bases={bases.map((base) => ({ value: base.id, label: base.name }))}
        counts={counts}
        globalContactUpdateCount={globalContactUpdateCount}
        qualificationOptions={Object.entries(qualificationLabels).map(([value, label]) => ({ value, label }))}
        stageOptions={Object.entries(COMMERCIAL_STAGE_LABELS).map(([value, label]) => ({ value, label }))}
      />

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        {result.companies.length === 0 ? (
          <div className="grid place-items-center gap-2 px-6 py-14 text-center">
            <Building2 className="size-8 text-zinc-300" />
            <strong>Nenhuma empresa encontrada</strong>
            <p className="max-w-md text-sm text-zinc-500">Remova alguns filtros ou altere o termo pesquisado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Empresa</th>
                  <th className="px-4 py-3 text-left font-medium">Localização</th>
                  <th className="px-4 py-3 text-left font-medium">Melhor contato</th>
                  <th className="px-4 py-3 text-left font-medium">Responsável</th>
                  <th className="px-4 py-3 text-left font-medium">Base e situação</th>
                  <th className="px-4 py-3 text-left font-medium">Atualização</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {result.companies.map((company) => {
                  const displayName = getCompanyDisplayName(company);
                  const secondaryName = getCompanySecondaryName(company);
                  const membership = values.baseId
                    ? company.bases.find((item) => item.baseId === values.baseId)
                    : company.bases[0];
                  const operationMembership = company.bases.find((item) => item.base.isActive);
                  const contact = company.contacts.find((item) => item.validity !== "INVALID");
                  const responsible = company.contactName || company.contacts.find((item) => item.responsibleName)?.responsibleName;
                  const rowHref = companyListUrl({ ...values, page: String(result.page) }, { companyId: company.id });
                  return (
                    <tr key={company.id} className={values.companyId === company.id ? "bg-blue-50/70" : "transition-colors hover:bg-zinc-50 motion-reduce:transition-none"}>
                      <td className="max-w-80 px-4 py-3">
                        <Link href={rowHref} scroll={false} className="font-semibold text-zinc-900 outline-none hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">{displayName}</Link>
                        {secondaryName && <p className="truncate text-xs text-zinc-500">{secondaryName}</p>}
                        <p className="mt-1 font-mono text-xs text-zinc-500">{formatCnpj(company.cnpj)}</p>
                      </td>
                      <td className="px-4 py-3">{[company.city, company.state].filter(Boolean).join("/") || "-"}</td>
                      <td className="max-w-60 px-4 py-3"><span className="block truncate">{contact?.value || company.phone || company.email || "Sem contato"}</span>{contact?.isWhatsapp && <Badge className="mt-1 bg-emerald-50 text-emerald-800">WhatsApp</Badge>}</td>
                      <td className="px-4 py-3">{responsible || <span className="text-zinc-400">Não informado</span>}</td>
                      <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{membership ? <><Badge variant="secondary">{membership.base.name}</Badge><Badge variant={membership.qualification === "ATUALIZAR_CONTATO" ? "outline" : "secondary"}>{membership.qualification ? qualificationLabels[membership.qualification] : COMMERCIAL_STAGE_LABELS[membership.stage]}</Badge></> : "-"}</div></td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">{company.updatedAt.toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1.5"><Button size="sm" variant="outline" nativeButton={false} render={<Link href={rowHref} scroll={false} />}><ExternalLink data-icon="inline-start" /> Dossiê</Button>{operationMembership && <Button size="sm" nativeButton={false} render={<Link href={`/operacao?baseId=${operationMembership.baseId}&companyId=${company.id}&returnTo=${encodeURIComponent(returnTo)}`} />}><PhoneCall data-icon="inline-start" /> Operação</Button>}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={pageSize} values={values} />

      {selectedCompany && <Dossier company={selectedCompany} returnTo={returnTo} />}
    </div>
  );
}

function Pagination({ page, totalPages, total, pageSize, values }: { page: number; totalPages: number; total: number; pageSize: number; values: Record<string, string> }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600"><p>{total.toLocaleString("pt-BR")} empresa{total === 1 ? "" : "s"} · página {page} de {totalPages}</p><div className="flex items-center gap-2"><CompanyPageSizeSelect value={pageSize} />{page > 1 ? <Button variant="outline" nativeButton={false} render={<Link href={companyListUrl(values, { page: String(page - 1), companyId: undefined })} />}><ChevronLeft data-icon="inline-start" /> Anterior</Button> : <Button variant="outline" disabled><ChevronLeft data-icon="inline-start" /> Anterior</Button>}{page < totalPages ? <Button variant="outline" nativeButton={false} render={<Link href={companyListUrl(values, { page: String(page + 1), companyId: undefined })} />}>Próxima <ChevronRight data-icon="inline-end" /></Button> : <Button variant="outline" disabled>Próxima <ChevronRight data-icon="inline-end" /></Button>}</div></div>;
}

type CompanyDetail = NonNullable<Awaited<ReturnType<typeof CompanyService.findById>>>;

function Dossier({ company, returnTo }: { company: CompanyDetail; returnTo: string }) {
  const displayName = getCompanyDisplayName(company);
  const secondaryName = getCompanySecondaryName(company);
  const operationMembership = company.bases.find((item) => item.base.isActive);
  return (
    <CompanyDossierSheet title={displayName}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>{secondaryName && <p className="text-sm text-zinc-600">{secondaryName}</p>}<p className="mt-1 font-mono text-xs text-zinc-500">{formatCnpj(company.cnpj)} · {[company.city, company.state].filter(Boolean).join("/") || "Localidade não informada"}</p></div>
        <div className="flex gap-2"><Button variant="outline" nativeButton={false} render={<Link href={`/empresas/${company.id}`} />}>Editar empresa</Button>{operationMembership && <Button nativeButton={false} render={<Link href={`/operacao?baseId=${operationMembership.baseId}&companyId=${company.id}&returnTo=${encodeURIComponent(returnTo)}`} />}>Abrir na Operação</Button>}</div>
      </div>

      <section className="space-y-3 rounded-lg border border-zinc-200 p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Contatos</h3><OperationContactPanel companyId={company.id} contacts={company.contacts} /></div>{company.contacts.length ? company.contacts.map((contact) => <div key={contact.id} className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-2 text-sm"><Badge variant="outline">{CONTACT_TYPE_LABELS[contact.type]}</Badge><strong>{contact.value}</strong>{contact.isWhatsapp && <Badge className="bg-emerald-50 text-emerald-800">WhatsApp</Badge>}<span className="text-zinc-500">{CONTACT_VALIDITY_LABELS[contact.validity]}</span>{contact.responsibleName && <span className="w-full text-xs text-zinc-500">{contact.responsibleName}{contact.role ? ` · ${contact.role}` : ""}</span>}</div>) : <p className="text-sm text-zinc-500">Nenhum contato individual cadastrado.</p>}<AddContactForm companyId={company.id} /></section>

      <section className="space-y-3 rounded-lg border border-zinc-200 p-4">
        <div><h3 className="font-semibold">Bases e classificação</h3><p className="mt-1 text-xs text-zinc-500">Ao concluir uma atualização, escolha manualmente a classificação adequada. O histórico anterior será preservado.</p></div>
        {company.bases.map((membership) => (
          <form action={updateCompanyQualification} key={membership.baseId} className="grid gap-2 border-t border-zinc-100 pt-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
            <input type="hidden" name="baseId" value={membership.baseId} />
            <input type="hidden" name="companyId" value={company.id} />
            <label className="grid gap-1 text-sm"><span className="font-medium text-zinc-600">{membership.base.name}</span><span className="text-xs text-zinc-500">Estágio: {COMMERCIAL_STAGE_LABELS[membership.stage]}</span></label>
            <label className="grid gap-1 text-sm"><span className="text-zinc-600">Qualificação</span><select name="qualification" defaultValue={membership.qualification || "EM_OPERACAO"} className="h-9 rounded-lg border border-input bg-white px-2.5">{Object.entries(qualificationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <Button type="submit" size="sm" variant="outline">Salvar</Button>
          </form>
        ))}
      </section>

      <section className="rounded-lg border border-zinc-200 p-4"><h3 className="mb-3 font-semibold">Editar cadastro</h3><EditCompanyProfileForm company={company} /></section>

      <section className="space-y-3 rounded-lg border border-zinc-200 p-4"><h3 className="flex items-center gap-2 font-semibold"><Clock3 size={17} /> Histórico recente</h3>{company.interactions.length ? company.interactions.slice(0, 10).map((interaction) => <article key={interaction.id} className="border-t border-zinc-100 pt-2 text-sm"><strong>{interaction.result ? INTERACTION_RESULT_LABELS[interaction.corrections[0]?.correctedResult || interaction.result] : "Ligação iniciada"}</strong><p className="text-xs text-zinc-500">{interaction.base.name} · {interaction.user.name} · {interaction.createdAt.toLocaleString("pt-BR")}</p>{interaction.notes && <p className="mt-1 whitespace-pre-wrap text-zinc-600">{interaction.notes}</p>}</article>) : <p className="text-sm text-zinc-500">Nenhuma interação registrada.</p>}</section>
      <p className="text-xs text-zinc-500">Última atualização do cadastro: {company.updatedAt.toLocaleString("pt-BR")}</p>
    </CompanyDossierSheet>
  );
}
