import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentSession } from "@/lib/auth-session";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-100 px-4 py-10">
      <section
        aria-labelledby="login-title"
        className="w-full max-w-md border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="mb-8">
          <p className="mb-3 text-sm font-semibold text-blue-600">
            SalesCockpit
          </p>
          <h1 className="text-2xl font-bold" id="login-title">
            Acesse sua conta
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Use as credenciais fornecidas pelo administrador.
          </p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
