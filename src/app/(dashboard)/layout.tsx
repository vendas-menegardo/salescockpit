import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth-session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <AppShell
      user={{
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      }}
    >
      {children}
    </AppShell>
  );
}
