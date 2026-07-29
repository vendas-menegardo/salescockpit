"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowLeft, ArrowRight, Clipboard, Loader2, Phone } from "lucide-react";
import type {
  CommercialStage,
  CompanyContact,
  FollowUpTask,
  InteractionResult,
  SalesInteraction,
} from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateCompanyContact } from "@/features/companies/actions/company-contact-actions";
import {
  moveOperationCursor,
  saveInteraction,
  type OperationActionState,
} from "../actions/operation-actions";
import {
  startCompanyCall,
  type CallActionState,
} from "../actions/call-actions";
import {
  COMMERCIAL_STAGE_LABELS,
  INTERACTION_RESULT_LABELS,
  type OperationView,
} from "../constants";

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
}: {
  current: MembershipData;
  previous: MembershipData | null;
  queue: MembershipData[];
  baseId: string;
  view: OperationView;
  idempotencyKey: string;
  callIdempotencyKey: string;
  operationScript: string | null;
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
          contact.validity !== "INVALID"
      )
      .map((contact) => ({
        key: contact.id,
        value: contact.value,
        contactId: contact.id,
        label: [contact.responsibleName, contact.role]
          .filter(Boolean)
          .join(" · "),
        primary: contact.isPrimary,
      })),
    ...(current.company.phone &&
    !current.company.contacts.some(
      (contact) => contact.value === current.company.phone
    )
      ? [
          {
            key: "imported-phone",
            value: current.company.phone,
            contactId: null,
            label: current.company.contactName || "Contato importado",
            primary: true,
          },
        ]
      : []),
  ].sort((a, b) => Number(b.primary) - Number(a.primary));
  const [selectedPhoneKey, setSelectedPhoneKey] = useState(
    availablePhones[0]?.key ?? ""
  );
  const selectedPhone =
    availablePhones.find((item) => item.key === selectedPhoneKey) ??
    availablePhones[0];
  const phone = selectedPhone?.value ?? null;

  async function copyPhone() {
    if (!phone) return;
    await navigator.clipboard.writeText(phone);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
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
              {current.company.cnpj ? ` · ${current.company.cnpj}` : ""}
            </p>
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
            <Button type="submit" size="sm" disabled={!phone || callPending}>
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
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={`/empresas/${current.companyId}#contatos`} />}
          >
            Adicionar contato
          </Button>
          {selectedPhone?.contactId && (
            <form action={updateCompanyContact}>
              <input
                type="hidden"
                name="contactId"
                value={selectedPhone.contactId}
              />
              <input type="hidden" name="intent" value="invalid" />
              <Button type="submit" variant="destructive" size="sm">
                Invalidar número
              </Button>
            </form>
          )}
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

        <form
          id="operation-interaction-form"
          action={action}
          className="grid min-h-0 gap-3"
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
                {Object.entries(INTERACTION_RESULT_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
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
