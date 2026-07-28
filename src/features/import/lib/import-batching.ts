import type {
  ImportJobStageRow,
  ImportPreviewRow,
} from "../types/import";

export function chunkItems<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError("O tamanho do lote deve ser um inteiro positivo.");
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function eligibleRowsForImport(
  rows: readonly ImportPreviewRow[]
): ImportJobStageRow[] {
  const seenCnpjs = new Set<string>();

  return rows.flatMap((row) => {
    if (!row.eligible || seenCnpjs.has(row.data.cnpj)) {
      return [];
    }

    seenCnpjs.add(row.data.cnpj);

    return [{ rowNumber: row.rowNumber, data: row.data }];
  });
}

export function getResumeWindow(
  totalRows: number,
  processedRows: number,
  batchSize: number
) {
  const start = Math.min(Math.max(0, processedRows), totalRows);

  return {
    start,
    end: Math.min(start + batchSize, totalRows),
    remaining: Math.max(0, totalRows - start),
  };
}

export function summarizeMembershipBatch(
  companyIds: readonly string[],
  createdCompanyIds: ReadonlySet<string>,
  createdMembershipCompanyIds: readonly string[]
) {
  const linkedCompanyIds = new Set(createdMembershipCompanyIds);

  return {
    linksCreated: linkedCompanyIds.size,
    existingCompaniesReused: createdMembershipCompanyIds.filter(
      (companyId) => !createdCompanyIds.has(companyId)
    ).length,
    alreadyInBase: companyIds.filter(
      (companyId) => !linkedCompanyIds.has(companyId)
    ).length,
  };
}

export type ImportBatchCounters = {
  processedRows: number;
  companiesCreated: number;
  existingCompaniesReused: number;
  linksCreated: number;
  alreadyInBase: number;
  conflictsPreserved: number;
};

export function addImportBatchCounters(
  current: ImportBatchCounters,
  batch: ImportBatchCounters
): ImportBatchCounters {
  return {
    processedRows: current.processedRows + batch.processedRows,
    companiesCreated: current.companiesCreated + batch.companiesCreated,
    existingCompaniesReused:
      current.existingCompaniesReused + batch.existingCompaniesReused,
    linksCreated: current.linksCreated + batch.linksCreated,
    alreadyInBase: current.alreadyInBase + batch.alreadyInBase,
    conflictsPreserved:
      current.conflictsPreserved + batch.conflictsPreserved,
  };
}

export function matchesImportJobIdentity(
  job: { baseId: string; fileHash: string },
  context: { baseId: string; fileHash: string }
) {
  return job.baseId === context.baseId && job.fileHash === context.fileHash;
}
