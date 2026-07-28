import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isAdminRole } from "@/features/auth/lib/access-control";
import { auth } from "@/lib/auth";

export const getCurrentSession = cache(async () =>
  auth.api.getSession({
    headers: await headers(),
  })
);

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}
export async function requireAdmin() {
  const session = await requireSession();

  if (!isAdminRole(session.user.role)) {
    redirect("/");
  }

  return session;
}
