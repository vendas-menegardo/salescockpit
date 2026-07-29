"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  updateCompanyProfile,
  type CompanyProfileActionState,
} from "../actions/company-profile-actions";

type EditableCompany = {
  id: string;
  corporateName: string;
  tradeName: string | null;
  segment: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  registrationStatus: string | null;
  legalNature: string | null;
  description: string | null;
  address: string | null;
  district: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
};

const initialState: CompanyProfileActionState = {};

export function EditCompanyProfileForm({
  company,
}: {
  company: EditableCompany;
}) {
  const [state, action, pending] = useActionState(
    updateCompanyProfile,
    initialState
  );
  return (
    <details className="border-t border-zinc-200 pt-4">
      <summary className="cursor-pointer text-sm font-medium text-blue-700">
        Editar cadastro
      </summary>
      <form action={action} className="mt-4 grid gap-3 md:grid-cols-2">
        <input type="hidden" name="companyId" value={company.id} />
        <Field label="Razão social">
          <Input
            name="corporateName"
            defaultValue={company.corporateName}
            required
            maxLength={255}
          />
        </Field>
        <Field label="Nome fantasia">
          <Input name="tradeName" defaultValue={company.tradeName || ""} maxLength={255} />
        </Field>
        <Field label="Segmento">
          <Input name="segment" defaultValue={company.segment || ""} maxLength={180} />
        </Field>
        <Field label="Situação cadastral">
          <Input name="registrationStatus" defaultValue={company.registrationStatus || ""} maxLength={120} />
        </Field>
        <Field label="Natureza jurídica">
          <Input name="legalNature" defaultValue={company.legalNature || ""} maxLength={255} />
        </Field>
        <Field label="Telefone principal">
          <Input name="phone" defaultValue={company.phone || ""} maxLength={255} />
        </Field>
        <Field label="E-mail principal">
          <Input name="email" type="email" defaultValue={company.email || ""} maxLength={255} />
        </Field>
        <Field label="Site">
          <Input name="website" defaultValue={company.website || ""} maxLength={500} />
        </Field>
        <Field label="Endereço">
          <Input name="address" defaultValue={company.address || ""} maxLength={500} />
        </Field>
        <Field label="Bairro">
          <Input name="district" defaultValue={company.district || ""} maxLength={180} />
        </Field>
        <Field label="CEP">
          <Input name="postalCode" defaultValue={company.postalCode || ""} maxLength={20} />
        </Field>
        <Field label="Cidade">
          <Input name="city" defaultValue={company.city || ""} maxLength={180} />
        </Field>
        <Field label="UF">
          <Input name="state" defaultValue={company.state || ""} maxLength={2} />
        </Field>
        <Field label="Descrição" wide>
          <Textarea name="description" defaultValue={company.description || ""} maxLength={2000} />
        </Field>
        <Field label="Observações gerais" wide>
          <Textarea name="notes" defaultValue={company.notes || ""} maxLength={4000} />
        </Field>
        <div className="flex items-center justify-end gap-3 md:col-span-2">
          {state.error && (
            <p role="alert" className="text-sm text-red-700">
              {state.error}
            </p>
          )}
          {state.success && (
            <p role="status" className="text-sm text-emerald-700">
              Cadastro atualizado.
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            {pending ? "Salvando" : "Salvar cadastro"}
          </Button>
        </div>
      </form>
    </details>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`grid gap-1 text-sm ${wide ? "md:col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}
