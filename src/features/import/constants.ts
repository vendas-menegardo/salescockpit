export const MAX_CSV_BYTES = 10 * 1024 * 1024;
export const MAX_CSV_SIZE_LABEL = "10 MB";

export function isCsvTextWithinSizeLimit(value: string) {
  return new TextEncoder().encode(value).byteLength <= MAX_CSV_BYTES;
}
