export function csvCell(value: unknown) {
  const raw =
    value instanceof Date
      ? new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          dateStyle: "short",
          timeStyle: "medium",
        }).format(value)
      : String(value ?? "");
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvRow(values: unknown[]) {
  return `${values.map(csvCell).join(";")}\r\n`;
}

export function safeExportFileName(
  type: "operacao" | "empresas",
  from: string,
  to: string
) {
  const safeDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "periodo";
  return `salescockpit-${type}-${safeDate(from)}-a-${safeDate(to)}.csv`;
}
