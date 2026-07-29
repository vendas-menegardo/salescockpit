import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Clock3, ContactRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddContactForm } from "@/features/companies/components/add-contact-form";
import { updateCompanyContact } from "@/features/companies/actions/company-contact-actions";
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
        <h1 className="text-2xl font-bold">{company.corporateName}</h1>
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
        </div>

        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <ContactRound size={18} /> Contatos
          </h2>
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
              <div className="ml-auto flex flex-wrap gap-1">
                {!contact.isPrimary && contact.validity !== "INVALID" && (
                  <ContactAction
                    contactId={contact.id}
                    intent="primary"
                    label="Tornar principal"
                  />
                )}
                {contact.validity !== "VALID" && (
                  <ContactAction
                    contactId={contact.id}
                    intent="valid"
                    label="Validar"
                  />
                )}
                {contact.validity !== "INVALID" && (
                  <ContactAction
                    contactId={contact.id}
                    intent="invalid"
                    label="Invalidar"
                  />
                )}
              </div>
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
            {company.interactions.map((interaction) => (
              <article key={interaction.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>
                    {interaction.result
                      ? INTERACTION_RESULT_LABELS[interaction.result]
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
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ContactAction({
  contactId,
  intent,
  label,
}: {
  contactId: string;
  intent: "valid" | "invalid" | "primary";
  label: string;
}) {
  return (
    <form action={updateCompanyContact}>
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="intent" value={intent} />
      <Button type="submit" size="xs" variant="ghost">
        {label}
      </Button>
    </form>
  );
}
