"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteBase } from "@/features/bases/actions/delete-base";

export function DeleteBaseButton({
  baseId,
  baseName,
}: {
  baseId: string;
  baseName: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button type="button" variant="destructive" />}
      >
        Excluir
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir base?</AlertDialogTitle>
          <AlertDialogDescription>
            A base {baseName} e seus vínculos serão removidos. As empresas
            centrais serão preservadas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <form action={deleteBase.bind(null, baseId)}>
            <DeleteSubmitButton />
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
function DeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit" variant="destructive">
      {pending ? (
        <LoaderCircle className="animate-spin" data-icon="inline-start" />
      ) : (
        <Trash2 data-icon="inline-start" />
      )}
      {pending ? "Excluindo..." : "Excluir base"}
    </Button>
  );
}
