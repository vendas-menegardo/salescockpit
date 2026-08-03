export type NormalizedPhoneCandidate = {
  canonical: string;
  national: string;
  display: string;
  extension: string | null;
};

export type PhoneNormalizationResult = {
  original: string;
  candidates: NormalizedPhoneCandidate[];
  ambiguous: boolean;
  reason: "empty" | "invalid" | "multiple" | "concatenated" | null;
};

const EXTENSION_PATTERN = /(?:ramal|ram\.?|r\.?|ext\.?|x)\s*[:.-]?\s*(\d{1,8})\s*$/i;
const EXPLICIT_SEPARATOR_PATTERN = /\s*(?:;|\||\n|\r)+\s*/;

function isPlausibleNationalNumber(value: string) {
  if (!/^\d+$/.test(value) || ![10, 11].includes(value.length)) return false;
  const areaCode = Number(value.slice(0, 2));
  if (areaCode < 11 || areaCode > 99 || value[2] === "0" || value[2] === "1") {
    return false;
  }
  return value.length === 10 || value[2] === "9";
}

function stripCountryCode(value: string) {
  if ([12, 13].includes(value.length) && value.startsWith("55")) {
    return value.slice(2);
  }
  return value;
}

function buildCandidate(
  digits: string,
  extension: string | null
): NormalizedPhoneCandidate | null {
  const national = stripCountryCode(digits);
  if (!isPlausibleNationalNumber(national)) return null;

  const areaCode = national.slice(0, 2);
  const subscriber = national.slice(2);
  const splitAt = subscriber.length === 9 ? 5 : 4;
  return {
    canonical: `55${national}`,
    national,
    display: `(${areaCode}) ${subscriber.slice(0, splitAt)}-${subscriber.slice(splitAt)}`,
    extension,
  };
}

function splitConcatenatedDigits(digits: string) {
  const candidates: Array<[string, string]> = [];
  for (const splitAt of [10, 11, 12, 13]) {
    const left = digits.slice(0, splitAt);
    const right = digits.slice(splitAt);
    if (!right) continue;
    if (
      buildCandidate(left, null) &&
      buildCandidate(right, null)
    ) {
      candidates.push([left, right]);
    }
  }
  return candidates;
}

function uniqueCandidates(candidates: NormalizedPhoneCandidate[]) {
  return [...new Map(candidates.map((item) => [item.canonical, item])).values()];
}

export function normalizeBrazilianPhone(input: unknown): PhoneNormalizationResult {
  const original = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!original) {
    return { original, candidates: [], ambiguous: false, reason: "empty" };
  }

  const explicitParts = original.split(EXPLICIT_SEPARATOR_PATTERN).filter(Boolean);
  if (explicitParts.length > 1) {
    const normalizedParts = explicitParts.map(normalizeBrazilianPhone);
    const candidates = uniqueCandidates(
      normalizedParts.flatMap((part) => part.candidates)
    );
    const invalidPart = normalizedParts.some(
      (part) => part.candidates.length === 0 || part.ambiguous
    );
    return {
      original,
      candidates,
      ambiguous: invalidPart,
      reason: invalidPart ? "multiple" : null,
    };
  }

  const extensionMatch = original.match(EXTENSION_PATTERN);
  const extension = extensionMatch?.[1] ?? null;
  const withoutExtension = extensionMatch
    ? original.slice(0, extensionMatch.index).trim()
    : original;
  const digits = withoutExtension.replace(/\D/g, "");
  const single = buildCandidate(digits, extension);
  if (single) {
    return { original, candidates: [single], ambiguous: false, reason: null };
  }

  const splitOptions = splitConcatenatedDigits(digits);
  if (splitOptions.length === 1) {
    const candidates = splitOptions[0]
      .map((part) => buildCandidate(part, null))
      .filter((item): item is NormalizedPhoneCandidate => Boolean(item));
    return {
      original,
      candidates: uniqueCandidates(candidates),
      ambiguous: false,
      reason: "concatenated",
    };
  }

  if (splitOptions.length > 1) {
    return { original, candidates: [], ambiguous: true, reason: "concatenated" };
  }

  return { original, candidates: [], ambiguous: false, reason: "invalid" };
}

export function canonicalPhone(value: unknown) {
  const normalized = normalizeBrazilianPhone(value);
  return normalized.ambiguous || normalized.candidates.length !== 1
    ? null
    : normalized.candidates[0].canonical;
}

export function whatsappPhone(value: unknown) {
  return canonicalPhone(value);
}
