"use client";

import type { CompanyContact } from "@prisma/client";
import { createContext, useActionState, useContext } from "react";
import { useFormStatus } from "react-dom";
import { Archive, Check, Loader2, Pencil, PhoneCall, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AddContactForm } from "@/features/companies/components/add-contact-form";
import {
  editCompanyContact,
  editPrimaryCompanyPhone,
  type ContactActionState,
  updateCompanyContact,
} from "@/features/companies/actions/company-contact-actions";
import { canonicalPhone } from "@/lib/phone-normalizer";
import {
  CONTACT_TYPE_LABELS,
  CONTACT_VALIDITY_LABELS,
} from "../constants";

const initialState: ContactActionState = {};
const ContactBaseContext = createContext<string | undefined>(undefined);

export function OperationContactPanel({
  companyId,
  baseId,
  contacts,
  primaryPhone,
  primaryResponsibleName,
}: {
  companyId: string;
  baseId?: string;
  contacts: CompanyContact[];
  primaryPhone?: string | null;
  primaryResponsibleName?: string | null;
}) {
  const primaryCanonical = primaryPhone ? canonicalPhone(primaryPhone) : null;
  const activeContacts = contacts.filter(
    (contact) =>
      !contact.archivedAt &&
      !(
        primaryCanonical &&
        ["PHONE", "WHATSAPP"].includes(contact.type) &&
        contact.canonicalValue === primaryCanonical
      )
  );
  const archivedContacts = contacts.filter((contact) => contact.archivedAt);

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" variant="ghost" size="sm">
            <PhoneCall data-icon="inline-start" />
            Editar telefones e contatos
          </Button>
        }
      />
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <ContactBaseContext.Provider value={baseId}>
        <SheetHeader className="border-b border-zinc-200">
          <SheetTitle>Contatos da empresa</SheetTitle>
          <SheetDescription>
            Telefones e e-mails são tratados individualmente e mantêm histórico.
          </SheetDescription>
        </SheetHeader>

        {primaryPhone && (
          <div className="mx-4 rounded-md border border-blue-200 bg-blue-50/60 p-3">
            <div className="mb-3 flex items-center gap-2">
              <Star className="size-4 fill-current text-amber-600" />
              <strong className="text-sm">Telefone principal</strong>
            </div>
            <PrimaryPhoneForm
              companyId={companyId}
              phone={primaryPhone}
              responsibleName={primaryResponsibleName}
            />
          </div>
        )}

        <div className="grid gap-3 px-4">
          <h3 className="text-sm font-semibold">Outros telefones e contatos</h3>
          {activeContacts.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum contato cadastrado.</p>
          ) : (
            activeContacts.map((contact) => (
              <ContactItem key={contact.id} contact={contact} />
            ))
          )}
        </div>

        <div className="px-4">
          <AddContactForm companyId={companyId} />
        </div>

        {archivedContacts.length > 0 && (
          <details className="mx-4 border-t border-zinc-200 pt-3">
            <summary className="cursor-pointer text-sm font-medium">
              Arquivados ({archivedContacts.length})
            </summary>
            <div className="mt-3 grid gap-2">
              {archivedContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 p-3 text-sm"
                >
                  <span className="min-w-0 truncate">{contact.value}</span>
                  <ContactIntentButton
                    contactId={contact.id}
                    intent="restore"
                    label="Restaurar"
                  />
                </div>
              ))}
            </div>
          </details>
        )}
        </ContactBaseContext.Provider>
      </SheetContent>
    </Sheet>
  );
}

function ContactItem({ contact }: { contact: CompanyContact }) {
  return (
    <article className="rounded-md border border-zinc-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{contact.value}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {CONTACT_TYPE_LABELS[contact.type]} · {CONTACT_VALIDITY_LABELS[contact.validity]}
            {contact.isWhatsapp ? " · WhatsApp" : ""}
            {contact.source ? ` · ${contact.source}` : ""}
          </p>
          {(contact.responsibleName || contact.role) && (
            <p className="mt-1 text-sm text-zinc-600">
              {[contact.responsibleName, contact.role].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {contact.isPrimary && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
            <Star className="size-3.5 fill-current" />
            Principal
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {!contact.isPrimary && contact.validity !== "INVALID" && (
          <ContactIntentButton
            contactId={contact.id}
            intent="primary"
            label="Tornar principal"
          />
        )}
        {contact.validity !== "VALID" && (
          <ContactIntentButton
            contactId={contact.id}
            intent="valid"
            label="Marcar válido"
          />
        )}
        {["PHONE", "WHATSAPP"].includes(contact.type) && (
          <ContactIntentButton
            contactId={contact.id}
            intent={contact.isWhatsapp ? "not_whatsapp" : "whatsapp"}
            label={contact.isWhatsapp ? "Remover WhatsApp" : "Marcar WhatsApp"}
          />
        )}
        {["PHONE", "WHATSAPP"].includes(contact.type) &&
          contact.validity !== "INVALID" && (
            <>
              <ContactIntentButton
                contactId={contact.id}
                intent="invalid_wrong"
                label="Número errado"
                reason="Número informado pertence a outro destinatário."
              />
              <ContactIntentButton
                contactId={contact.id}
                intent="invalid_nonexistent"
                label="Número inexistente"
                reason="Operadora informou que o número não existe."
              />
              <ContactIntentButton
                contactId={contact.id}
                intent="invalid_unavailable"
                label="Indisponível"
                reason="Número indisponível após tentativa de ligação."
              />
              <ContactIntentButton
                contactId={contact.id}
                intent="invalid_out_of_service"
                label="Fora de serviço"
                reason="Número informado como fora de serviço."
              />
              <ContactIntentButton
                contactId={contact.id}
                intent="invalid_third_party"
                label="Terceiro / contabilidade"
                reason="Número pertence a terceiro e não deve ser usado para contatar a empresa."
              />
            </>
          )}
        {contact.type === "EMAIL" && contact.validity !== "INVALID" && (
          <ContactIntentButton
            contactId={contact.id}
            intent="invalid_email"
            label="E-mail inválido"
            reason="Endereço de e-mail confirmado como inválido."
          />
        )}
        <ContactIntentButton
          contactId={contact.id}
          intent="archive"
          label="Arquivar"
          icon={<Archive />}
        />
      </div>

      <details className="mt-3 border-t border-zinc-100 pt-2">
        <summary className="inline-flex cursor-pointer items-center gap-1 text-sm text-blue-700">
          <Pencil className="size-3.5" />
          Editar
        </summary>
        <EditContactForm contact={contact} />
      </details>
    </article>
  );
}

function PrimaryPhoneForm({
  companyId,
  phone,
  responsibleName,
}: {
  companyId: string;
  phone: string;
  responsibleName?: string | null;
}) {
  const [state, action, pending] = useActionState(
    editPrimaryCompanyPhone,
    initialState
  );
  return (
        <form action={action} className="grid gap-3">
          <input type="hidden" name="companyId" value={companyId} />
          <label className="grid gap-1 text-sm">
            Telefone principal
            <Input name="value" defaultValue={phone} required maxLength={255} />
          </label>
          <label className="grid gap-1 text-sm">
            Responsável por este telefone
            <Input
              name="responsibleName"
              defaultValue={responsibleName || ""}
              maxLength={120}
            />
          </label>
          {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
          {state.success && <p role="status" className="text-sm text-emerald-700">Telefone atualizado.</p>}
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
            {pending ? "Salvando" : "Salvar telefone"}
          </Button>
        </form>
  );
}

function ContactIntentButton({
  contactId,
  intent,
  label,
  reason,
  icon,
}: {
  contactId: string;
  intent: string;
  label: string;
  reason?: string;
  icon?: React.ReactNode;
}) {
  const baseId = useContext(ContactBaseContext);
  return (
    <form action={updateCompanyContact}>
      <input type="hidden" name="contactId" value={contactId} />
      {baseId && <input type="hidden" name="baseId" value={baseId} />}
      <input type="hidden" name="intent" value={intent} />
      {reason && <input type="hidden" name="reason" value={reason} />}
      <PendingSubmitButton label={label} icon={icon} size="xs" />
    </form>
  );
}

function PendingSubmitButton({
  label,
  icon,
  size = "sm",
}: {
  label: string;
  icon?: React.ReactNode;
  size?: "xs" | "sm";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size={size} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : icon}
      {pending ? "Salvando" : label}
    </Button>
  );
}

function EditContactForm({ contact }: { contact: CompanyContact }) {
  const [state, action, pending] = useActionState(
    editCompanyContact,
    initialState
  );
  return (
    <form action={action} className="mt-3 grid gap-2">
      <input type="hidden" name="contactId" value={contact.id} />
      <label className="grid gap-1 text-xs">
        Contato
        <Input name="value" defaultValue={contact.value} required maxLength={255} />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">
          Responsável
          <Input
            name="responsibleName"
            defaultValue={contact.responsibleName || ""}
            maxLength={120}
          />
        </label>
        <label className="grid gap-1 text-xs">
          Função
          <Input name="role" defaultValue={contact.role || ""} maxLength={120} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input name="isWhatsapp" type="checkbox" defaultChecked={contact.isWhatsapp} />
        Disponível no WhatsApp
      </label>
      <label className="grid gap-1 text-xs">
        Observação
        <Input name="notes" defaultValue={contact.notes || ""} maxLength={500} />
      </label>
      <div className="flex items-center justify-end gap-2">
        {state.error && <p className="text-xs text-red-700">{state.error}</p>}
        {state.success && (
          <p className="inline-flex items-center gap-1 text-xs text-emerald-700">
            <Check className="size-3.5" /> Atualizado
          </p>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}
