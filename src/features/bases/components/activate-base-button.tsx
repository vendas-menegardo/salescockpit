"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setActiveBase } from "@/features/bases/actions/set-active-base";

export function ActivateBaseButton({ baseId }: { baseId: string }) {
  return (
    <form action={setActiveBase.bind(null, baseId)}>
      <SubmitButton />
    </form>
  );
}
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending && (
        <LoaderCircle className="animate-spin" data-icon="inline-start" />
      )}
      {pending ? "Ativando..." : "Ativar"}
    </Button>
  );
}
