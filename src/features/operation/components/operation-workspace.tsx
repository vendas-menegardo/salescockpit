"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clipboard,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import type {
  CommercialStage,
  CompanyQualification,
  CompanyContact,
  FollowUpTask,
  InteractionResult,
  SalesInteraction,
} from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { canonicalCnpj, displayCnpj } from "@/lib/cnpj";
import { whatsappPhone } from "@/lib/phone-normalizer";
import {
  moveOperationCursor,
  recordCommunicationEvent,
  saveInteraction,
  updateCompanyQualification,
  type OperationActionState,
} from "../actions/operation-actions";
import {
  startCompanyCall,
  type CallActionState,
} from "../actions/call-actions";
import {
  CALL_INTERACTION_RESULTS,
  COMMERCIAL_STAGE_LABELS,
  COMPANY_QUALIFICATION_LABELS,
  INTERACTION_RESULT_LABELS,
  type OperationView,
} from "../constants";
import { OperationContactPanel } from "./operation-contact-panel";
import { OperationCompanyPanel } from "./operation-company-panel";

type CompanyData = {
  id: string;
  corporateName: string;
  tradeName: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  segment: string | null;
  contactName: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  contacts: CompanyContact[];
  followUps: FollowUpTask[];
  interactions: Array<
    SalesInteraction & { user: { id: string; name: string } }
  >;
};

type MembershipData = {
  baseId: string;
  companyId: string;
  stage: CommercialStage;
  qualification: CompanyQualification | null;
  qualificationReason: string | null;
  company: CompanyData;
};

const initialState: OperationActionState = {};
const initialCallState: CallActionState = {};

export function OperationWorkspace({
  current,
  previous,
  queue,
  baseId,
  view,
  idempotencyKey,
  callIdempotencyKey,
  operationScript,
  returnTo,
}: {
  current: MembershipData;
  previous: MembershipData | null;
  queue: MembershipData[];
  baseId: string;
  view: OperationView;
  idempotencyKey: string;
  callIdempotencyKey: string;
  operationScript: string | null;
  returnTo?: string;
}) {
  const [state, action, pending] = useActionState(
    saveInteraction,
    initialState
  );
  const [callState, callAction, callPending] = useActionState(
    startCompanyCall,
    initialCallState
  );
  const [copied, setCopied] = useState(false);
  const [cnpjCopied, setCnpjCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [communicationMessage, setCommunicationMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [communicationStatus, setCommunicationStatus] = useState<string | null>(null);
  const [communicationPending, startCommunicationTransition] = useTransition();
  const index = queue.findIndex(
    (item) => item.companyId === current.companyId
  );
  const previousMembership =
    previous ?? (index > 0 ? queue[index - 1] : null);
  const next =
    index >= 0
      ? queue[index + 1] ?? null
      : queue.find((item) => item.companyId !== current.companyId) ?? null;
  const availablePhones = [
    ...current.company.contacts
      .filter(
        (contact) =>
          ["PHONE", "WHATSAPP"].includes(contact.type) &&
          contact.validity !== "INVALID" &&
          !contact.archivedAt
      )
      .map((contact) => ({
        key: contact.id,
        value: contact.value,
        contactId: contact.id,
        canonical: contact.canonicalValue,
        isWhatsapp: contact.isWhatsapp || contact.type === "WHATSAPP",
        label: [contact.responsibleName, contact.role]
          .filter(Boolean)
          .join(" · "),
        primary: contact.isPrimary,
      })),
    ...(current.company.phone &&
    !current.company.contacts.some(
      (contact) =>
        contact.value === current.company.phone ||
        (contact.canonicalValue &&
          contact.canonicalValue === whatsappPhone(current.company.phone))
    )
      ? [
          {
            key: "imported-phone",
            value: current.company.phone,
            contactId: null,
            canonical: whatsappPhone(current.company.phone),
            isWhatsapp: false,
            label: current.company.contactName || "Contato importado",
            primary: true,
          },
        ]
      : []),
  ].sort(
    (a, b) =>
      Number(b.primary) - Number(a.primary) ||
      Number(b.isWhatsapp) - Number(a.isWhatsapp)
  );
  const [selectedPhoneKey, setSelectedPhoneKey] = useState(
    availablePhones[0]?.key ?? ""
  );
  const availableEmails = [
    ...current.company.contacts
      .filter(
        (contact) =>
          contact.type === "EMAIL" &&
          contact.validity !== "INVALID" &&
          !contact.archivedAt
      )
      .map((contact) => ({
        key: contact.id,
        value: contact.value,
        contactId: contact.id,
        primary: contact.isPrimary,
      })),
    ...(current.company.email &&
    !current.company.contacts.some(
      (contact) =>
        contact.type === "EMAIL" && contact.value === current.company.email
    )
      ? [
          {
            key: "imported-email",
            value: current.company.email,
            contactId: null,
            primary: true,
          },
        ]
      : []),
  ].sort((a, b) => Number(b.primary) - Number(a.primary));
  const [selectedEmailKey, setSelectedEmailKey] = useState(
    availableEmails[0]?.key ?? ""
  );

  const selectedPhone =
    availablePhones.find((item) => item.key === selectedPhoneKey) ??
    availablePhones[0];
  const phone = selectedPhone?.value ?? null;
  const selectedEmail =
    availableEmails.find((item) => item.key === selectedEmailKey) ??
    availableEmails[0];
  const email = selectedEmail?.value ?? null;
  const formattedCnpj = displayCnpj(current.company.cnpj);
  const canonicalCompanyCnpj = canonicalCnpj(current.company.cnpj);

  async function copyPhone() {
    if (!phone) return;
    await navigator.clipboard.writeText(phone);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function copyCnpj() {
    if (!canonicalCompanyCnpj) return;
    await navigator.clipboard.writeText(canonicalCompanyCnpj);
    setCnpjCopied(true);
    window.setTimeout(() => setCnpjCopied(false), 1500);
  }

  function recordCommunication({
    channel,
    result,
    contactId,
    contactUsed,
    openUrl,
  }: {
    channel: "EMAIL" | "WHATSAPP";
    result:
      | "EMAIL_PREPARADO"
      | "EMAIL_ENVIADO"
      | "EMAIL_RESPOSTA"
      | "WHATSAPP_PREPARADO"
      | "WHATSAPP_ENVIADO";
    contactId: string | null;
    contactUsed: string;
    openUrl?: string;
  }) {
    setCommunicationStatus(null);
    startCommunicationTransition(async () => {
      const response = await recordCommunicationEvent({
        baseId,
        companyId: current.companyId,
        contactId: contactId || undefined,
        channel,
        result,
        contactUsed,
        subject: channel === "EMAIL" ? emailSubject : undefined,
        message: communicationMessage || undefined,
      });
      if (response.error) {
        setCommunicationStatus(response.error);
        return;
      }
      setCommunicationStatus(
        result.endsWith("ENVIADO") ? "Envio registrado." : "Mensagem preparada."
      );
      if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
      <section className="flex min-h-0 flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">
              {current.company.corporateName}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {[current.company.city, current.company.state]
                .filter(Boolean)
                .join("/") || "Localidade não informada"}
            </p>
            {formattedCnpj && (
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-zinc-500">
                <span>CNPJ: {formattedCnpj}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={copyCnpj}
                  disabled={!canonicalCompanyCnpj}
                >
                  <Clipboard data-icon="inline-start" />
                  {cnpjCopied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            )}
            <p className="mt-0.5 truncate text-sm text-zinc-500">
              {current.company.segment || "Segmento não informado"}
              {current.company.email ? ` · ${current.company.email}` : ""}
            </p>
          </div>
          <Badge>{COMMERCIAL_STAGE_LABELS[current.stage]}</Badge>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {availablePhones.length > 0 ? (
            <select
              aria-label="Telefone da ligação"
              value={selectedPhoneKey}
              onChange={(event) => setSelectedPhoneKey(event.target.value)}
              className="h-8 max-w-full rounded-lg border border-input bg-white px-2.5 text-sm"
            >
              {availablePhones.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.value}
                  {item.label ? ` · ${item.label}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-medium">Sem telefone</span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!phone}
            onClick={copyPhone}
          >
            <Clipboard data-icon="inline-start" />
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <form action={callAction}>
            <input type="hidden" name="baseId" value={baseId} />
            <input
              type="hidden"
              name="companyId"
              value={current.companyId}
            />
            <input type="hidden" name="phone" value={phone || ""} />
            <input
              type="hidden"
              name="idempotencyKey"
              value={callIdempotencyKey}
            />
            <Button
              type="submit"
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={!phone || callPending}
            >
              {callPending ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Phone data-icon="inline-start" />
              )}
              {callPending ? "Chamando" : "Ligar"}
            </Button>
          </form>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={`/empresas/${current.companyId}`} />}
          >
            Abrir dossiê
          </Button>
          {returnTo && (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={returnTo} />}
            >
              Voltar para empresas
            </Button>
          )}
          <OperationContactPanel
            companyId={current.companyId}
            contacts={current.company.contacts}
          />
          <OperationCompanyPanel company={current.company} />
        </div>
        {callState.message && (
          <p
            role="status"
            className={
              callState.status === "error"
                ? "text-sm text-red-700"
                : "text-sm text-zinc-600"
            }
          >
            {callState.message}
          </p>
        )}

        <details className="shrink-0 rounded-md border border-zinc-200 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            E-mail e WhatsApp
          </summary>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <div className="grid gap-2">
              <label className="grid gap-1 text-xs">
                E-mail
                <select
                  aria-label="E-mail selecionado"
                  value={selectedEmailKey}
                  onChange={(event) => setSelectedEmailKey(event.target.value)}
                  disabled={availableEmails.length === 0}
                  className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm"
                >
                  {availableEmails.length === 0 ? (
                    <option value="">Sem e-mail</option>
                  ) : (
                    availableEmails.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.value}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="grid gap-1 text-xs">
                Assunto
                <input
                  value={emailSubject}
                  onChange={(event) => setEmailSubject(event.target.value)}
                  maxLength={200}
                  className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!email}
                  onClick={async () => {
                    if (!email) return;
                    await navigator.clipboard.writeText(email);
                    setEmailCopied(true);
                    window.setTimeout(() => setEmailCopied(false), 1500);
                  }}
                >
                  <Clipboard data-icon="inline-start" />
                  {emailCopied ? "Copiado" : "Copiar e-mail"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!email || communicationPending}
                  onClick={() =>
                    email &&
                    recordCommunication({
                      channel: "EMAIL",
                      result: "EMAIL_PREPARADO",
                      contactId: selectedEmail?.contactId ?? null,
                      contactUsed: email,
                      openUrl: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(communicationMessage)}`,
                    })
                  }
                >
                  <Mail data-icon="inline-start" /> Preparar e-mail
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!email || communicationPending}
                  onClick={() =>
                    email &&
                    recordCommunication({
                      channel: "EMAIL",
                      result: "EMAIL_ENVIADO",
                      contactId: selectedEmail?.contactId ?? null,
                      contactUsed: email,
                    })
                  }
                >
                  Marcar como enviado
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!email || communicationPending}
                  onClick={() =>
                    email &&
                    recordCommunication({
                      channel: "EMAIL",
                      result: "EMAIL_RESPOSTA",
                      contactId: selectedEmail?.contactId ?? null,
                      contactUsed: email,
                    })
                  }
                >
                  Registrar resposta
                </Button>
              </div>
            </div>

            <div className="grid content-start gap-2">
              <label className="grid gap-1 text-xs">
                Mensagem
                <Textarea
                  value={communicationMessage}
                  onChange={(event) => setCommunicationMessage(event.target.value)}
                  maxLength={2000}
                  className="min-h-20 resize-none"
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    !selectedPhone?.canonical || communicationPending
                  }
                  onClick={() => {
                    if (!selectedPhone?.canonical || !phone) return;
                    recordCommunication({
                      channel: "WHATSAPP",
                      result: "WHATSAPP_PREPARADO",
                      contactId: selectedPhone.contactId,
                      contactUsed: phone,
                      openUrl: `https://wa.me/${selectedPhone.canonical}?text=${encodeURIComponent(communicationMessage)}`,
                    });
                  }}
                >
                  <MessageCircle data-icon="inline-start" /> Preparar WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!selectedPhone?.canonical || communicationPending}
                  onClick={() => {
                    if (!phone) return;
                    recordCommunication({
                      channel: "WHATSAPP",
                      result: "WHATSAPP_ENVIADO",
                      contactId: selectedPhone?.contactId ?? null,
                      contactUsed: phone,
                    });
                  }}
                >
                  Marcar como enviado
                </Button>
              </div>
            </div>
          </div>
          {communicationStatus && (
            <p role="status" className="mt-2 text-xs text-zinc-600">
              {communicationStatus}
            </p>
          )}
        </details>

        <form
          action={updateCompanyQualification}
          className="grid shrink-0 gap-2 rounded-md border border-zinc-200 p-2 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]"
        >
          <input type="hidden" name="baseId" value={baseId} />
          <input type="hidden" name="companyId" value={current.companyId} />
          <label className="grid gap-1 text-xs">
            Qualificação operacional
            <select
              name="qualification"
              defaultValue={current.qualification || "EM_OPERACAO"}
              className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm"
            >
              {Object.entries(COMPANY_QUALIFICATION_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                )
              )}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            Motivo
            <input
              name="reason"
              defaultValue={current.qualificationReason || ""}
              maxLength={500}
              className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm"
              placeholder="Obrigatório para congelada, perdida ou inapta"
            />
          </label>
          <Button type="submit" variant="outline" size="sm" className="self-end">
            Atualizar
          </Button>
        </form>

        <form
          id="operation-interaction-form"
          action={action}
          className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto pr-1"
        >
          <input type="hidden" name="baseId" value={baseId} />
          <input type="hidden" name="companyId" value={current.companyId} />
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <input
            type="hidden"
            name="apiInteractionId"
            value={callState.interactionId || ""}
          />
          <input type="hidden" name="contactUsed" value={phone || ""} />
          <input
            type="hidden"
            name="contactId"
            value={selectedPhone?.contactId || ""}
          />
          <div className="grid gap-2 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Resultado
              <select
                name="result"
                required
                className="h-8 rounded-lg border border-input bg-transparent px-2.5"
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione
                </option>
                {CALL_INTERACTION_RESULTS.map((value) => (
                  <option key={value} value={value}>
                    {INTERACTION_RESULT_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Próximo estágio
              <select
                name="nextStage"
                required
                className="h-8 rounded-lg border border-input bg-transparent px-2.5"
                defaultValue={current.stage}
              >
                {Object.entries(COMMERCIAL_STAGE_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            Observação
            <Textarea
              name="notes"
              maxLength={2000}
              className="max-h-20 min-h-14 resize-none overflow-y-auto"
            />
          </label>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Data e hora do retorno
              <input
                type="datetime-local"
                name="followUpAt"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Motivo do retorno
              <input
                name="followUpReason"
                maxLength={500}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5"
              />
            </label>
          </div>
          {state.error && (
            <p role="alert" className="text-sm text-red-700">
              {state.error}
            </p>
          )}
        </form>
        <div className="flex shrink-0 flex-wrap justify-between gap-2 border-t border-zinc-100 pt-3">
          <div className="flex gap-2">
            <CursorButton
              label="Anterior"
              icon={<ArrowLeft />}
              membership={previousMembership}
              currentId={current.companyId}
              baseId={baseId}
              view={view}
            />
            <CursorButton
              label="Pular"
              icon={<ArrowRight />}
              membership={next}
              currentId={current.companyId}
              baseId={baseId}
              view={view}
            />
          </div>
          <Button
            type="submit"
            form="operation-interaction-form"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={pending}
          >
            {pending && (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            )}
            {pending ? "Salvando" : "Salvar e avançar"}
          </Button>
        </div>
      </section>

      <aside className="grid min-h-0 gap-3 rounded-lg border border-zinc-200 bg-white p-4 lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden">
        <section>
          <h2 className="text-sm font-semibold">Roteiro comercial</h2>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-600 lg:max-h-24 lg:overflow-y-auto">
            {operationScript ||
              "Nenhum roteiro foi configurado para esta base. O administrador pode adicioná-lo ao editar a base."}
          </p>
        </section>

        <section className="min-h-0 border-t border-zinc-100 pt-3">
          <h2 className="font-semibold">Histórico recente</h2>
          <div className="mt-2 space-y-3 lg:h-[calc(100%-2rem)] lg:overflow-y-auto lg:pr-1">
            {current.company.interactions.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Nenhuma interação registrada.
              </p>
            ) : (
              current.company.interactions.map((interaction) => (
                <article
                  key={interaction.id}
                  className="border-t border-zinc-100 pt-3 text-sm first:border-0 first:pt-0"
                >
                  <strong>
                    {interaction.result
                      ? INTERACTION_RESULT_LABELS[
                          interaction.result as InteractionResult
                        ]
                      : "Ligação iniciada"}
                  </strong>
                  <p className="text-zinc-500">
                    {interaction.user.name} ·{" "}
                    {new Date(interaction.createdAt).toLocaleString("pt-BR")}
                  </p>
                  {interaction.notes && (
                    <p className="mt-1 whitespace-pre-wrap">
                      {interaction.notes}
                    </p>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function CursorButton({
  label,
  icon,
  membership,
  currentId,
  baseId,
  view,
}: {
  label: string;
  icon: React.ReactNode;
  membership: MembershipData | null;
  currentId: string;
  baseId: string;
  view: OperationView;
}) {
  return (
    <form action={moveOperationCursor}>
      <input type="hidden" name="baseId" value={baseId} />
      <input type="hidden" name="companyId" value={membership?.companyId ?? ""} />
      <input type="hidden" name="previousCompanyId" value={currentId} />
      <input type="hidden" name="view" value={view} />
      <Button type="submit" variant="outline" disabled={!membership}>
        {icon}
        {label}
      </Button>
    </form>
  );
}
