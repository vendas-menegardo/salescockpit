export const COMPANY_FILTER_KEYS = [
  "query",
  "baseId",
  "city",
  "qualification",
  "stage",
  "phoneStatus",
  "whatsapp",
  "emailStatus",
  "responsible",
  "operationStatus",
  "lastInteractionFrom",
  "lastInteractionTo",
  "updatedFrom",
  "updatedTo",
  "quickView",
  "pageSize",
] as const;

export function companyListUrl(
  values: Record<string, string | undefined>,
  overrides: Record<string, string | undefined> = {}
) {
  const params = new URLSearchParams();
  for (const key of [...COMPANY_FILTER_KEYS, "page", "companyId"] as const) {
    const value = Object.prototype.hasOwnProperty.call(overrides, key)
      ? overrides[key]
      : values[key];
    if (value) params.set(key, value);
  }
  return `/empresas${params.size ? `?${params}` : ""}`;
}

export function operationReturnUrl(values: Record<string, string | undefined>) {
  return companyListUrl(values, { companyId: undefined });
}
