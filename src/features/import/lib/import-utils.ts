import type { ImportCompanyData } from "../types/import";

export type CompanyDataFields = Omit<ImportCompanyData, "cnpj">;

const HEADER_ALIASES: Record<keyof ImportCompanyData, string[]> = {
  cnpj: ["cnpj", "cnpjempresa"],
  corporateName: ["razaosocial", "razao", "corporatename"],
  tradeName: ["nomefantasia", "fantasia", "tradename"],
  segment: ["categoria", "segmento", "segment"],
  city: ["cidade", "municipio", "city"],
  state: ["uf", "estado", "state"],
  phone: ["telefone", "fone", "phone"],
  email: ["email", "emailempresa"],
  website: ["site", "website"],
};

export const COMPANY_FIELD_LABELS: Record<keyof CompanyDataFields, string> = {
  corporateName: "razão social",
  tradeName: "nome fantasia",
  segment: "segmento",
  city: "cidade",
  state: "UF",
  phone: "telefone",
  email: "e-mail",
  website: "site",
};

const MUTABLE_FIELDS = Object.keys(
  COMPANY_FIELD_LABELS
) as (keyof CompanyDataFields)[];

export function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

export function recognizeHeader(value: string) {
  const normalized = normalizeHeader(value);

  return (
    Object.entries(HEADER_ALIASES).find(([, aliases]) =>
      aliases.includes(normalized)
    )?.[0] as keyof ImportCompanyData | undefined
  );
}

export function normalizeText(value?: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
}

export function normalizeCnpj(value?: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

export function normalizeEmail(value?: unknown) {
  return normalizeText(value).toLowerCase();
}

export function normalizeState(value?: unknown) {
  return normalizeText(value).toUpperCase();
}

export function normalizePhone(value?: unknown) {
  return normalizeText(value);
}

export function normalizeWebsite(value?: unknown) {
  return normalizeText(value);
}

export function isValidCnpj(value: string) {
  const cnpj = normalizeCnpj(value);

  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const calculateDigit = (digits: string, weights: number[]) => {
    const sum = digits
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;

    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(
    cnpj.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );
  const secondDigit = calculateDigit(
    cnpj.slice(0, 12) + firstDigit,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );

  return cnpj.endsWith(`${firstDigit}${secondDigit}`);
}

export function formatCnpj(value?: string | null) {
  const cnpj = normalizeCnpj(value);

  if (cnpj.length !== 14) {
    return cnpj || "-";
  }

  return cnpj.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

export function mapCsvRow(
  row: Record<string, unknown>
): ImportCompanyData {
  const recognized = new Map<keyof ImportCompanyData, string>();

  for (const [header, rawValue] of Object.entries(row)) {
    const field = recognizeHeader(header);
    const value = normalizeText(rawValue);

    if (field && value && !recognized.has(field)) {
      recognized.set(field, value);
    }
  }

  return {
    cnpj: normalizeCnpj(recognized.get("cnpj")),
    corporateName: normalizeText(recognized.get("corporateName")),
    tradeName: normalizeText(recognized.get("tradeName")),
    segment: normalizeText(recognized.get("segment")),
    city: normalizeText(recognized.get("city")),
    state: normalizeState(recognized.get("state")),
    phone: normalizePhone(recognized.get("phone")),
    email: normalizeEmail(recognized.get("email")),
    website: normalizeWebsite(recognized.get("website")),
  };
}

export function isEmptyCsvRow(row: Record<string, unknown>) {
  return Object.values(row).every((value) => normalizeText(value) === "");
}

export function isDuplicateCnpj(cnpj: string, seenCnpjs: Set<string>) {
  if (seenCnpjs.has(cnpj)) {
    return true;
  }

  seenCnpjs.add(cnpj);
  return false;
}

function comparableValue(field: keyof CompanyDataFields, value: string) {
  const normalized = normalizeText(value);

  if (field === "email") {
    return normalizeEmail(normalized);
  }

  if (field === "state") {
    return normalizeState(normalized);
  }

  if (field === "phone") {
    const digits = normalized.replace(/\D/g, "");
    return digits || normalized.toLowerCase();
  }

  if (field === "website") {
    return normalized.toLowerCase().replace(/\/+$/, "");
  }

  return normalized.toLocaleLowerCase("pt-BR");
}

export function mergeCompanyData(
  existing: Partial<Record<keyof CompanyDataFields, string | null>>,
  incoming: CompanyDataFields
) {
  const updates: Partial<CompanyDataFields> = {};
  const conflicts: (keyof CompanyDataFields)[] = [];
  const filledFields: (keyof CompanyDataFields)[] = [];

  for (const field of MUTABLE_FIELDS) {
    const currentValue = normalizeText(existing[field]);
    const incomingValue = normalizeText(incoming[field]);

    if (!incomingValue) {
      continue;
    }

    if (!currentValue) {
      updates[field] = incoming[field];
      filledFields.push(field);
      continue;
    }

    if (
      comparableValue(field, currentValue) !==
      comparableValue(field, incomingValue)
    ) {
      conflicts.push(field);
    }
  }

  return {
    updates,
    conflicts,
    filledFields,
  };
}
