import test from "node:test";
import assert from "node:assert/strict";

import {
  isDuplicateCnpj,
  isValidCnpj,
  mapCsvRow,
  mergeCompanyData,
  normalizeCnpj,
  normalizeHeader,
} from "../src/features/import/lib/import-utils.ts";
import {
  isCsvTextWithinSizeLimit,
  IMPORT_PROCESS_BATCH_SIZE,
  IMPORT_STAGING_BATCH_SIZE,
  MAX_CSV_BYTES,
  MAX_CSV_SIZE_LABEL,
} from "../src/features/import/constants.ts";
import {
  addImportBatchCounters,
  chunkItems,
  eligibleRowsForImport,
  getResumeWindow,
  matchesImportJobIdentity,
  summarizeMembershipBatch,
} from "../src/features/import/lib/import-batching.ts";

test("normaliza CNPJ removendo máscara", () => {
  assert.equal(normalizeCnpj("12.345.678/0001-95"), "12345678000195");
});

test("valida formato e dígitos verificadores do CNPJ", () => {
  assert.equal(isValidCnpj("12.345.678/0001-95"), true);
  assert.equal(isValidCnpj("12.345.678/0001-96"), false);
  assert.equal(isValidCnpj("11.111.111/1111-11"), false);
});

test("normaliza cabeçalhos ignorando acentos, espaços, underscore e hífen", () => {
  assert.equal(normalizeHeader("Razão Social"), "razaosocial");
  assert.equal(normalizeHeader("CNPJ_Empresa"), "cnpjempresa");
  assert.equal(normalizeHeader("Nome-Fantasia"), "nomefantasia");
});

test("reconhece variações de cabeçalho e normaliza valores", () => {
  const row = mapCsvRow({
    "CNPJ Empresa": "12.345.678/0001-95",
    razao_social: "  Empresa   Exemplo Ltda  ",
    "Nome-Fantasia": " Exemplo ",
    Categoria: " Serviços ",
    Cidade: " Vitória ",
    UF: "es",
    Telefone: " (27) 3333-4444 ",
    "E-mail": " CONTATO@EXEMPLO.COM.BR ",
    Site: " https://exemplo.com.br ",
  });

  assert.deepEqual(row, {
    cnpj: "12345678000195",
    corporateName: "Empresa Exemplo Ltda",
    tradeName: "Exemplo",
    segment: "Serviços",
    city: "Vitória",
    state: "ES",
    phone: "(27) 3333-4444",
    email: "contato@exemplo.com.br",
    website: "https://exemplo.com.br",
  });
});

test("identifica CNPJ duplicado dentro do arquivo", () => {
  const seen = new Set();

  assert.equal(isDuplicateCnpj("12345678000195", seen), false);
  assert.equal(isDuplicateCnpj("12345678000195", seen), true);
});

test("campo vazio do CSV não apaga dado existente", () => {
  const merge = mergeCompanyData(
    {
      corporateName: "Empresa Exemplo Ltda",
      email: "contato@exemplo.com.br",
    },
    {
      corporateName: "",
      tradeName: "",
      segment: "",
      city: "",
      state: "",
      phone: "",
      email: "",
      website: "",
    }
  );

  assert.deepEqual(merge.updates, {});
  assert.deepEqual(merge.conflicts, []);
});

test("preenche campo vazio e preserva valor existente em conflito", () => {
  const merge = mergeCompanyData(
    {
      corporateName: "Empresa Exemplo Ltda",
      tradeName: null,
      email: "financeiro@exemplo.com.br",
    },
    {
      corporateName: "Empresa Exemplo Ltda",
      tradeName: "Exemplo",
      segment: "",
      city: "",
      state: "",
      phone: "",
      email: "contato@exemplo.com.br",
      website: "",
    }
  );

  assert.deepEqual(merge.updates, {
    tradeName: "Exemplo",
  });
  assert.deepEqual(merge.conflicts, ["email"]);
});

test("aplica limite de 10 MB usando o tamanho real em UTF-8", () => {
  assert.equal(MAX_CSV_BYTES, 10 * 1024 * 1024);
  assert.equal(MAX_CSV_SIZE_LABEL, "10 MB");
  assert.equal(isCsvTextWithinSizeLimit("a".repeat(MAX_CSV_BYTES)), true);
  assert.equal(isCsvTextWithinSizeLimit("a".repeat(MAX_CSV_BYTES + 1)), false);
  assert.equal(isCsvTextWithinSizeLimit("á".repeat(MAX_CSV_BYTES / 2)), true);
  assert.equal(
    isCsvTextWithinSizeLimit("á".repeat(MAX_CSV_BYTES / 2 + 1)),
    false
  );
});

test("divide mais de 7.000 empresas em lotes limitados", () => {
  const rows = Array.from({ length: 7_416 }, (_, index) => index);
  const stagingBatches = chunkItems(rows, IMPORT_STAGING_BATCH_SIZE);
  const processingBatches = chunkItems(rows, IMPORT_PROCESS_BATCH_SIZE);

  assert.equal(stagingBatches.length, 30);
  assert.equal(processingBatches.length, 30);
  assert.equal(stagingBatches.flat().length, rows.length);
  assert.ok(
    stagingBatches.every((batch) => batch.length <= IMPORT_STAGING_BATCH_SIZE)
  );
  assert.ok(
    processingBatches.every((batch) => batch.length <= IMPORT_PROCESS_BATCH_SIZE)
  );
  assert.equal(processingBatches.at(-1).length, 166);
});

test("deduplica antes da divisão mesmo quando a repetição cruzaria lotes", () => {
  const companyData = (cnpj) => ({
    cnpj,
    corporateName: `Empresa ${cnpj}`,
    tradeName: "",
    segment: "",
    city: "",
    state: "",
    phone: "",
    email: "",
    website: "",
  });
  const rows = Array.from({ length: 501 }, (_, index) => ({
    rowNumber: index + 2,
    data: companyData(String(index).padStart(14, "0")),
    status: "new_company",
    detail: "",
    eligible: true,
    conflicts: [],
  }));
  rows[250] = {
    ...rows[250],
    data: companyData(rows[0].data.cnpj),
  };

  const eligible = eligibleRowsForImport(rows);
  const batches = chunkItems(eligible, IMPORT_STAGING_BATCH_SIZE);

  assert.equal(eligible.length, 500);
  assert.equal(new Set(eligible.map((row) => row.data.cnpj)).size, 500);
  assert.equal(batches.length, 2);
});

test("reimportação idempotente não cria empresas nem vínculos novamente", () => {
  const companyIds = ["company-1", "company-2", "company-3"];
  const summary = summarizeMembershipBatch(
    companyIds,
    new Set(),
    []
  );

  assert.deepEqual(summary, {
    linksCreated: 0,
    existingCompaniesReused: 0,
    alreadyInBase: 3,
  });
});

test("reenvio da mesma coleção produz a mesma preparação deduplicada", () => {
  const rows = [
    {
      rowNumber: 2,
      data: {
        cnpj: "12345678000195",
        corporateName: "Empresa Exemplo",
        tradeName: "",
        segment: "",
        city: "",
        state: "",
        phone: "",
        email: "",
        website: "",
      },
      status: "new_company",
      detail: "",
      eligible: true,
      conflicts: [],
    },
  ];

  assert.deepEqual(eligibleRowsForImport(rows), eligibleRowsForImport(rows));
});

test("retomada começa após o último lote confirmado", () => {
  const totalRows = 7_416;
  const confirmedBeforeFailure = IMPORT_PROCESS_BATCH_SIZE * 7;
  const resume = getResumeWindow(
    totalRows,
    confirmedBeforeFailure,
    IMPORT_PROCESS_BATCH_SIZE
  );

  assert.deepEqual(resume, {
    start: confirmedBeforeFailure,
    end: confirmedBeforeFailure + IMPORT_PROCESS_BATCH_SIZE,
    remaining: totalRows - confirmedBeforeFailure,
  });

  const remainingBatches = chunkItems(
    Array.from({ length: resume.remaining }),
    IMPORT_PROCESS_BATCH_SIZE
  );
  assert.equal(
    confirmedBeforeFailure + remainingBatches.flat().length,
    totalRows
  );
});

test("acumula contadores corretamente após lotes sucessivos", () => {
  const initial = {
    processedRows: 0,
    companiesCreated: 0,
    existingCompaniesReused: 0,
    linksCreated: 0,
    alreadyInBase: 0,
    conflictsPreserved: 0,
  };
  const afterFirstBatch = addImportBatchCounters(initial, {
    processedRows: 250,
    companiesCreated: 180,
    existingCompaniesReused: 50,
    linksCreated: 230,
    alreadyInBase: 20,
    conflictsPreserved: 4,
  });
  const afterSecondBatch = addImportBatchCounters(afterFirstBatch, {
    processedRows: 166,
    companiesCreated: 100,
    existingCompaniesReused: 40,
    linksCreated: 140,
    alreadyInBase: 26,
    conflictsPreserved: 3,
  });

  assert.deepEqual(afterSecondBatch, {
    processedRows: 416,
    companiesCreated: 280,
    existingCompaniesReused: 90,
    linksCreated: 370,
    alreadyInBase: 46,
    conflictsPreserved: 7,
  });
});

test("hash ou base diferente não identifica o mesmo job para retomada", () => {
  const job = {
    baseId: "base-a",
    fileHash: "a".repeat(64),
  };

  assert.equal(matchesImportJobIdentity(job, job), true);
  assert.equal(
    matchesImportJobIdentity(job, {
      baseId: "base-a",
      fileHash: "b".repeat(64),
    }),
    false
  );
  assert.equal(
    matchesImportJobIdentity(job, {
      baseId: "base-b",
      fileHash: "a".repeat(64),
    }),
    false
  );
});
