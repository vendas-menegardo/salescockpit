export const MAX_CSV_BYTES = 10 * 1024 * 1024;
export const MAX_CSV_SIZE_LABEL = "10 MB";
export const IMPORT_STAGING_BATCH_SIZE = 250;
export const IMPORT_PROCESS_BATCH_SIZE = 250;
export const IMPORT_LOOKUP_BATCH_SIZE = 5_000;

export function isCsvTextWithinSizeLimit(value: string) {
  return new TextEncoder().encode(value).byteLength <= MAX_CSV_BYTES;
}
