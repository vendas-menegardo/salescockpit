export const APP_ROLES = {
  ADMIN: "admin",
  USER: "user",
} as const;

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];

const ADMIN_ONLY_ROUTES = ["/importacao", "/usuarios"];

export function hasRole(role: string | null | undefined, expected: AppRole) {
  return (role ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .includes(expected);
}
export function isAdminRole(role: string | null | undefined) {
  return hasRole(role, APP_ROLES.ADMIN);
}

export function canAccessRoute(
  role: string | null | undefined,
  pathname: string
) {
  const requiresAdmin = ADMIN_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  return !requiresAdmin || isAdminRole(role);
}
