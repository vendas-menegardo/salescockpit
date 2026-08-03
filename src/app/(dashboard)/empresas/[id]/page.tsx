import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Clock3, ContactRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddContactForm } from "@/features/companies/components/add-contact-form";
import { EditCompanyProfileForm } from "@/features/companies/components/edit-company-profile-form";
import { InteractionCorrectionForm } from "@/features/companies/components/interaction-correction-form";
import { OperationContactPanel } from "@/features/operation/components/operation-contact-panel";
import { CompanyService } from "@/features/companies/services/company-service";
import { calculateCompanyCompleteness } from "@/features/companies/lib/company-completeness";
import { formatCnpj } from "@/features/import/lib/import-utils";
import {
  COMMERCIAL_STAGE_LABELS,
  CONTACT_TYPE_LABELS,
  CONTACT_VALIDITY_LABELS,
  INTERACTION_RESULT_LABELS,
} from "@/features/operation/constants";

export default async function CompanyDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await CompanyService.findById(id);
  if (!company) notFound();

  const importedContacts = [
    company.phone && { label: "Telefone", value: company.phone },
    company.email && { label: "E-mail", value: company.email },
    company.website && { label: "Site", value: company.website },
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  const completeness = calculateCompanyCompleteness({
    ...company,
    contactCount: company.contacts.length,
  });
  const activeOperationMembership = company.bases.find(
    (membership) => membership.base.isActive
  );
  const latestResultInteractionId = company.interactions.find(
    (interaction) => interaction.result
  )?.id;

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          className="mb-2 -ml-2"
          nativeButton={false}
          render={<Link href="/empresas" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Empresas
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{company.corporateName}</h1>
          {activeOperationMembership && (
            <Button
              nativeButton={false}
              render={
                <Link
                  href={`/operacao?baseId=${activeOperationMembership.baseId}&companyId=${company.id}&returnTo=/empresas/${company.id}`}
                />
              }
            >
              Abrir na Operação
            </Button>
          )}
        </div>
        <p className="mt-1 font-mono text-sm text-zinc-500">
          {formatCnpj(company.cnpj)}
        </p>
        <div className="mt-3 flex max-w-sm items-center gap-3 text-sm">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200"
            aria-label={`Completude do dossiê: ${completeness}%`}
          >
            <div
              className="h-full bg-blue-600"
              style={{ width: `${completeness}%` }}
            />
          </div>
          <span className="text-zinc-600">{completeness}% completo</span>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div
          id="contatos"
          className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5"
        >
          <h2 className="flex items-center gap-2 font-semibold">
            <Building2 size={18} /> Cadastro
          </h2>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-zinc-500">Nome fantasia</dt>
            <dd>{company.tradeName || "-"}</dd>
            <dt className="text-zinc-500">Segmento</dt>
            <dd>{company.segment || "-"}</dd>
            <dt className="text-zinc-500">Localidade</dt>
            <dd>{[company.city, company.state].filter(Boolean).join("/") || "-"}</dd>
            <dt className="text-zinc-500">Situação cadastral</dt>
            <dd>{company.registrationStatus || "-"}</dd>
            <dt className="text-zinc-500">Natureza jurídica</dt>
            <dd>{company.legalNature || "-"}</dd>
            <dt className="text-zinc-500">Endereço</dt>
            <dd>
              {[company.address, company.district, company.postalCode]
                .filter(Boolean)
                .join(" · ") || "-"}
            </dd>
            <dt className="text-zinc-500">Descrição</dt>
            <dd>{company.description || "-"}</dd>
            <dt className="text-zinc-500">Observações</dt>
            <dd className="whitespace-pre-wrap">{company.notes || "-"}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            {company.bases.map((membership) => (
              <Badge key={membership.baseId} variant="secondary">
                {membership.base.name}:{" "}
                {COMMERCIAL_STAGE_LABELS[membership.stage]}
              </Badge>
            ))}
          </div>
          <EditCompanyProfileForm company={company} />
        </div>

        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <ContactRound size={18} /> Contatos
            </h2>
            <OperationContactPanel companyId={company.id} contacts={company.contacts} />
          </div>
          {importedContacts.map((contact) => (
            <div key={contact.label} className="text-sm">
              <span className="text-zinc-500">{contact.label}: </span>
              {contact.value}
            </div>
          ))}
          {company.contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 text-sm"
            >
              <Badge variant="outline">{CONTACT_TYPE_LABELS[contact.type]}</Badge>
              <strong>{contact.value}</strong>
              <span className="text-zinc-500">
                {CONTACT_VALIDITY_LABELS[contact.validity]}
              </span>
              {contact.isPrimary && <Badge>Principal</Badge>}
              {(contact.responsibleName || contact.role) && (
                <span className="w-full text-zinc-500">
                  {[contact.responsibleName, contact.role]
                    .filter(Boolean)
                  .join(" · ")}
                </span>
              )}
            </div>
          ))}
          <AddContactForm companyId={company.id} />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Clock3 size={18} /> Histórico comercial
        </h2>
        {company.interactions.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nenhuma interação registrada.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {company.interactions.map((interaction) => {
              const effectiveResult =
                interaction.corrections[0]?.correctedResult ?? interaction.result;
              return (
              <article key={interaction.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>
                    {effectiveResult
                      ? INTERACTION_RESULT_LABELS[effectiveResult]
                      : "Ligação iniciada"}
                  </strong>
                  <Badge variant="outline">{interaction.base.name}</Badge>
                  <span className="text-zinc-500">
                    {interaction.user.name} ·{" "}
                    {interaction.createdAt.toLocaleString("pt-BR")}
                  </span>
                </div>
                {interaction.notes && (
                  <p className="mt-1 whitespace-pre-wrap text-zinc-600">
                    {interaction.notes}
                  </p>
                )}
                {interaction.corrections.length > 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    Resultado corrigido com auditoria por {interaction.corrections[0].user.name}.
                  </p>
                )}
                {interaction.id === latestResultInteractionId && effectiveResult && (
                  <InteractionCorrectionForm
                    companyId={company.id}
                    interactionId={interaction.id}
                    currentResult={effectiveResult}
                  />
                )}
              </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Building2 size={18} /> Histórico de enriquecimento
        </h2>
        {company.dataChanges.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nenhuma alteração de cadastro registrada.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {company.dataChanges.map((change) => (
              <article key={change.id} className="py-3 text-sm">
                <strong>
                  {Object.keys(change.changedFields as object).length} campo
                  {Object.keys(change.changedFields as object).length === 1
                    ? ""
                    : "s"}{" "}
                  atualizado
                  {Object.keys(change.changedFields as object).length === 1
                    ? ""
                    : "s"}
                </strong>
                <p className="mt-1 text-zinc-500">
                  {change.user?.name || "Sistema"} ·{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(change.createdAt)}{" "}
                  · completude {change.completenessBefore}% para{" "}
                  {change.completenessAfter}%
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
