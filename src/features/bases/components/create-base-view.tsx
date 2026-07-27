import { CreateBaseForm } from "./create-base-form";

export function CreateBaseView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nova Base</h1>
        <p className="text-muted-foreground">
          Cadastre uma nova base comercial.
        </p>
      </div>

      <CreateBaseForm />
    </div>
  );
}