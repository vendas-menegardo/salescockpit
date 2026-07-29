"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTACT_TYPE_LABELS,
  CONTACT_VALIDITY_LABELS,
} from "@/features/operation/constants";
import {
  addCompanyContact,
  type ContactActionState,
} from "../actions/company-contact-actions";

const initialState: ContactActionState = {};

export function AddContactForm({ companyId }: { companyId: string }) {
  const [state, action, pending] = useActionState(
    addCompanyContact,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-3 border-t border-zinc-200 pt-4 md:grid-cols-2"
    >
      <input type="hidden" name="companyId" value={companyId} />
      <label className="grid gap-1 text-sm">
        Tipo
        <select
          name="type"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          defaultValue="PHONE"
        >
          {Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Contato
        <Input name="value" required maxLength={255} />
      </label>
      <label className="grid gap-1 text-sm">
        Responsável
        <Input name="responsibleName" maxLength={120} />
      </label>
      <label className="grid gap-1 text-sm">
        Função
        <Input name="role" maxLength={120} />
      </label>
      <label className="grid gap-1 text-sm">
        Origem
        <Input name="source" maxLength={120} placeholder="Ex.: importação" />
      </label>
      <label className="grid gap-1 text-sm">
        Validação
        <select
          name="validity"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          defaultValue="UNKNOWN"
        >
          {Object.entries(CONTACT_VALIDITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm md:col-span-2">
        Observações
        <Textarea name="notes" maxLength={500} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="isPrimary" type="checkbox" />
        Contato principal deste tipo
      </label>
      <div className="flex items-center justify-end gap-3">
        {state.error && (
          <p role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <Plus data-icon="inline-start" />
          )}
          {pending ? "Salvando" : "Adicionar contato"}
        </Button>
      </div>
    </form>
  );
}
