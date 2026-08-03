"use client";

import { useActionState } from "react";
import type { InteractionResult } from "@prisma/client";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  correctLatestInteractionResult,
  type OperationActionState,
} from "@/features/operation/actions/operation-actions";
import { INTERACTION_RESULT_LABELS } from "@/features/operation/constants";

const initialState: OperationActionState = {};

export function InteractionCorrectionForm({
  companyId,
  interactionId,
  currentResult,
}: {
  companyId: string;
  interactionId: string;
  currentResult: InteractionResult;
}) {
  const [state, action, pending] = useActionState(
    correctLatestInteractionResult,
    initialState
  );

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-medium text-blue-700">
        Corrigir resultado mais recente
      </summary>
      <form action={action} className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="interactionId" value={interactionId} />
        <select
          name="correctedResult"
          defaultValue={currentResult}
          className="h-8 rounded-lg border border-input bg-white px-2.5"
          aria-label="Resultado corrigido"
        >
          {Object.entries(INTERACTION_RESULT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          name="reason"
          required
          minLength={3}
          maxLength={500}
          placeholder="Motivo da correção"
          className="h-8 rounded-lg border border-input bg-white px-2.5"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
          Registrar correção
        </Button>
        {state.error && (
          <p role="alert" className="text-xs text-red-700 sm:col-span-3">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-xs text-emerald-700 sm:col-span-3">
            Correção registrada no histórico.
          </p>
        )}
      </form>
    </details>
  );
}
