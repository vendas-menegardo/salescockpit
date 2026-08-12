"use client";

import { useActionState, useEffect, useRef } from "react";
import { Check, CheckCircle2, Loader2, Plus, Star, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CONTACT_TYPE_LABELS, CONTACT_VALIDITY_LABELS } from "@/features/operation/constants";
import {
  addEnrichmentCandidate,
  completeEnrichment,
  reviewEnrichmentCandidate,
  type EnrichmentActionState,
} from "../actions/enrichment-actions";

type Contact = {
  id: string;
  type: "PHONE" | "WHATSAPP" | "EMAIL" | "WEBSITE" | "INSTAGRAM" | "OTHER";
  value: string;
  source: string | null;
  validity: "UNKNOWN" | "VALID" | "INVALID";
  isPrimary: boolean;
  isWhatsapp: boolean;
  responsibleName: string | null;
  role: string | null;
  archivedAt: Date | null;
};

const initialState: EnrichmentActionState = {};

function Feedback({ state }: { state: EnrichmentActionState }) {
  if (!state.error && !state.success) return null;
  return <p role="status" className={`text-sm ${state.error ? "text-red-700" : "text-emerald-700"}`}>{state.error || state.success}</p>;
}

function CandidateActions({ contact }: { contact: Contact }) {
  const [state, action, pending] = useActionState(reviewEnrichmentCandidate, initialState);
  if (contact.archivedAt) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <form action={action}>
        <input type="hidden" name="contactId" value={contact.id} />
        <input type="hidden" name="decision" value="accept" />
        <Button type="submit" size="sm" disabled={pending || contact.validity === "VALID"}>
          {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}
          Validar
        </Button>
      </form>
      <form action={action}>
        <input type="hidden" name="contactId" value={contact.id} />
        <input type="hidden" name="decision" value="primary" />
        <Button type="submit" size="sm" variant="outline" disabled={pending || contact.validity === "INVALID" || contact.isPrimary}>
          <Star data-icon="inline-start" /> Principal
        </Button>
      </form>
      <form action={action}>
        <input type="hidden" name="contactId" value={contact.id} />
        <input type="hidden" name="decision" value="reject" />
        <Button type="submit" size="sm" variant="ghost" disabled={pending || contact.validity === "INVALID"}>
          <X data-icon="inline-start" /> Rejeitar
        </Button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

function AddCandidateForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(addEnrichmentCandidate, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.success) formRef.current?.reset(); }, [state.success]);
  return (
    <form ref={formRef} action={action} className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 sm:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <label className="grid gap-1 text-sm"><span className="font-medium">Tipo</span><select name="type" defaultValue="PHONE" className="h-9 rounded-lg border border-input bg-white px-2.5">{Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">Contato encontrado</span><Input name="value" required maxLength={255} placeholder="Telefone, e-mail ou endereço" /></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">Fonte consultada</span><Input name="source" required maxLength={120} placeholder="Ex.: site institucional" /></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">Responsável</span><Input name="responsibleName" maxLength={120} placeholder="Nome, quando disponível" /></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">Função</span><Input name="role" maxLength={120} /></label>
      <label className="flex items-end gap-2 pb-2 text-sm"><input name="isWhatsapp" type="checkbox" className="size-4" /> Disponível no WhatsApp</label>
      <label className="grid gap-1 text-sm sm:col-span-2"><span className="font-medium">Evidência ou observação</span><Textarea name="notes" maxLength={500} placeholder="Onde o dado foi encontrado ou o que precisa ser conferido" /></label>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <Feedback state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
          {pending ? "Adicionando" : "Adicionar candidato"}
        </Button>
      </div>
    </form>
  );
}

export function EnrichmentReviewPanel({ companyId, contacts, memberships }: { companyId: string; contacts: Contact[]; memberships: Array<{ baseId: string; baseName: string; qualification: string | null }> }) {
  const [completionState, completionAction, completionPending] = useActionState(completeEnrichment, initialState);
  const activeContacts = contacts.filter((contact) => !contact.archivedAt);
  const validCount = activeContacts.filter((contact) => contact.validity === "VALID" && ["PHONE", "WHATSAPP", "EMAIL"].includes(contact.type)).length;
  const pendingMemberships = memberships.filter((membership) => membership.qualification === "ATUALIZAR_CONTATO");
  return (
    <div className="space-y-5">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold text-zinc-950">Contatos e candidatos</h3><p className="mt-1 text-sm text-zinc-500">Dados novos permanecem pendentes até serem validados.</p></div><Badge variant={validCount ? "secondary" : "outline"}>{validCount} validado{validCount === 1 ? "" : "s"}</Badge></div>
        <div className="space-y-3">
          {activeContacts.length === 0 && <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">Nenhum contato individual cadastrado.</p>}
          {activeContacts.map((contact) => (
            <article key={contact.id} className={`rounded-lg border p-4 ${contact.validity === "VALID" ? "border-emerald-200 bg-emerald-50/40" : contact.validity === "INVALID" ? "border-zinc-200 bg-zinc-50 opacity-70" : "border-amber-200 bg-amber-50/40"}`}>
              <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{CONTACT_TYPE_LABELS[contact.type]}</Badge><strong className="break-all text-sm">{contact.value}</strong>{contact.isPrimary && <Badge>Principal</Badge>}{contact.isWhatsapp && <Badge className="bg-emerald-100 text-emerald-800">WhatsApp</Badge>}<span className="text-xs text-zinc-500">{CONTACT_VALIDITY_LABELS[contact.validity]}</span></div>
              <p className="mt-2 text-xs text-zinc-500">Fonte: {contact.source || "não informada"}{contact.responsibleName ? ` · ${contact.responsibleName}${contact.role ? ` (${contact.role})` : ""}` : ""}</p>
              <CandidateActions contact={contact} />
            </article>
          ))}
        </div>
      </section>
      <section><h3 className="mb-3 font-semibold text-zinc-950">Novo candidato</h3><AddCandidateForm companyId={companyId} /></section>
      <section className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><h3 className="flex items-center gap-2 font-semibold text-zinc-950"><CheckCircle2 size={18} className="text-blue-600" /> Concluir atualização</h3><p className="mt-1 max-w-xl text-sm text-zinc-600">A empresa volta para a fila normal somente após existir um contato validado. O histórico desta mudança será preservado.</p></div>
          {pendingMemberships.map((membership) => <form key={membership.baseId} action={completionAction}><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="baseId" value={membership.baseId} /><Button type="submit" disabled={completionPending || validCount === 0}>{completionPending && <Loader2 className="animate-spin" data-icon="inline-start" />}Concluir em {membership.baseName}</Button></form>)}
        </div><div className="mt-3"><Feedback state={completionState} /></div>
      </section>
    </div>
  );
}
