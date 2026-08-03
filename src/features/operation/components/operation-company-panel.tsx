"use client";

import { useActionState } from "react";
import { Check, Loader2, Pencil } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  updateQuickCompanyProfile,
  type CompanyProfileActionState,
} from "@/features/companies/actions/company-profile-actions";

const initialState: CompanyProfileActionState = {};

export function OperationCompanyPanel({
  company,
}: {
  company: {
    id: string;
    corporateName: string;
    tradeName: string | null;
    contactName: string | null;
    notes: string | null;
  };
}) {
  const [state, action, pending] = useActionState(
    updateQuickCompanyProfile,
    initialState
  );

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" variant="ghost" size="sm">
            <Pencil data-icon="inline-start" />
            Editar empresa
          </Button>
        }
      />
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b border-zinc-200">
          <SheetTitle>Edição rápida</SheetTitle>
          <SheetDescription>
            Atualize dados operacionais sem substituir a razão social.
          </SheetDescription>
        </SheetHeader>
        <form action={action} className="grid gap-4 px-4">
          <input type="hidden" name="companyId" value={company.id} />
          <label className="grid gap-1 text-sm">
            Razão social
            <Input value={company.corporateName} disabled />
          </label>
          <label className="grid gap-1 text-sm">
            Nome público
            <Input name="tradeName" defaultValue={company.tradeName || ""} maxLength={255} />
          </label>
          <label className="grid gap-1 text-sm">
            Presidente, representante ou responsável
            <Input name="contactName" defaultValue={company.contactName || ""} maxLength={255} />
          </label>
          <label className="grid gap-1 text-sm">
            Observações gerais
            <Textarea name="notes" defaultValue={company.notes || ""} maxLength={4000} />
          </label>
          {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
          {state.success && (
            <p role="status" className="inline-flex items-center gap-1 text-sm text-emerald-700">
              <Check className="size-4" /> Dados atualizados.
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
            Salvar alterações
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
