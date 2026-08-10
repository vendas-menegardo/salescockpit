import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { CreateUserForm } from "@/features/users/components/create-user-form";
import { UserRow } from "@/features/users/components/user-row";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

const USERS_PER_PAGE = 25;

type UsersPageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

export default async function UsuariosPage({ searchParams }: UsersPageProps) {
  const session = await requireAdmin();
  const requestedPage = Number.parseInt((await searchParams).page ?? "1", 10);
  const normalizedPage = Number.isFinite(requestedPage)
    ? Math.max(1, requestedPage)
    : 1;
  const totalUsers = await prisma.user.count();
  const totalPages = Math.max(1, Math.ceil(totalUsers / USERS_PER_PAGE));
  const page = Math.min(normalizedPage, totalPages);
  const users = await prisma.user.findMany({
    orderBy: [{ banned: "asc" }, { name: "asc" }],
    skip: (page - 1) * USERS_PER_PAGE,
    take: USERS_PER_PAGE,
    select: {
      banned: true,
      email: true,
      id: true,
      name: true,
      role: true,
      sessions: {
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
        take: 1,
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Crie contas, defina perfis e controle o acesso ao SalesCockpit."
      />

      <section
        aria-labelledby="new-user-title"
        className="workspace-surface space-y-4 rounded-lg p-5 sm:p-6"
      >
        <div>
          <h2 className="font-semibold" id="new-user-title">
            Novo usuário
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            A senha inicial deve ter pelo menos 12 caracteres.
          </p>
        </div>
        <CreateUserForm />
      </section>

      <section aria-labelledby="users-title" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold" id="users-title">
            Contas cadastradas
          </h2>
          <span className="text-sm text-zinc-500">
            {totalUsers} {totalUsers === 1 ? "usuário" : "usuários"}
          </span>
        </div>

        <div className="workspace-surface divide-y divide-zinc-100 overflow-hidden rounded-lg">
          {users.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-zinc-500">
              Nenhum usuário cadastrado.
            </p>
          ) : (
            users.map((user) => (
              <UserRow
                currentUserId={session.user.id}
                key={user.id}
                user={{
                  ...user,
                  lastSessionAt:
                    user.sessions[0]?.createdAt.toISOString() ?? null,
                }}
              />
            ))
          )}
        </div>

        {totalPages > 1 && (
          <nav
            aria-label="Paginação de usuários"
            className="flex items-center justify-end gap-2"
          >
            {page > 1 ? (
              <Button
                nativeButton={false}
                render={<Link href={`/usuarios?page=${page - 1}`} />}
                variant="outline"
              >
                <ChevronLeft data-icon="inline-start" />
                Anterior
              </Button>
            ) : (
              <Button disabled type="button" variant="outline">
                <ChevronLeft data-icon="inline-start" />
                Anterior
              </Button>
            )}
            <span className="text-sm text-zinc-600">
              Página {Math.min(page, totalPages)} de {totalPages}
            </span>
            {page < totalPages ? (
              <Button
                nativeButton={false}
                render={<Link href={`/usuarios?page=${page + 1}`} />}
                variant="outline"
              >
                Próxima
                <ChevronRight data-icon="inline-end" />
              </Button>
            ) : (
              <Button disabled type="button" variant="outline">
                Próxima
                <ChevronRight data-icon="inline-end" />
              </Button>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
