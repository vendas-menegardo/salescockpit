import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentSession } from "@/lib/auth-session";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session) {
    redirect("/");
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#f5f7fb] px-4 py-10">
      <section
        aria-labelledby="login-title"
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-[0_18px_48px_rgba(16,24,40,0.10)] sm:p-8"
      >
        <div className="mb-8">
          <div className="mb-5 flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">SC</span><strong className="text-lg">SalesCockpit</strong></div>
          <h1 className="text-2xl font-bold text-zinc-950" id="login-title">
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
