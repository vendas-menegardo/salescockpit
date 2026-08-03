export function canonicalCnpj(value: unknown) {
  const canonical = String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return canonical.length === 14 ? canonical : null;
}

export function displayCnpj(value: unknown) {
  const canonical = canonicalCnpj(value);
  if (!canonical) return null;
  if (!/^\d{14}$/.test(canonical)) return canonical;
  return canonical.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}
