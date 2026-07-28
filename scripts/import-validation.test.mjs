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
  MAX_CSV_BYTES,
  MAX_CSV_SIZE_LABEL,
} from "../src/features/import/constants.ts";

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
