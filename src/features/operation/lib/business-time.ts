export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
export const BUSINESS_UTC_OFFSET = "-03:00";

export function parseBusinessDateTime(value: string) {
  const normalized = value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    ? `${value}:00${BUSINESS_UTC_OFFSET}`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_DATE");
  return date;
}
