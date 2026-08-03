import test from "node:test";
import assert from "node:assert/strict";

import {
  canonicalPhone,
  normalizeBrazilianPhone,
  whatsappPhone,
} from "../src/lib/phone-normalizer.ts";
import { canonicalCnpj, displayCnpj } from "../src/lib/cnpj.ts";

test("normaliza telefone brasileiro e codigo do pais", () => {
  assert.equal(canonicalPhone("(27) 3333-4444"), "552733334444");
  assert.equal(canonicalPhone("+55 (27) 99921-4489"), "5527999214489");
  assert.equal(whatsappPhone("27 99921-4489"), "5527999214489");
});

test("preserva original e reconhece ramal", () => {
  const result = normalizeBrazilianPhone("(27) 3333-4444 ramal 123");
  assert.equal(result.original, "(27) 3333-4444 ramal 123");
  assert.equal(result.candidates[0].extension, "123");
  assert.equal(result.candidates[0].canonical, "552733334444");
});

test("separa numeros explicitamente delimitados", () => {
  const result = normalizeBrazilianPhone(
    "(27) 3333-4444; (27) 99921-4489"
  );
  assert.deepEqual(
    result.candidates.map((item) => item.canonical),
    ["552733334444", "5527999214489"]
  );
  assert.equal(result.ambiguous, false);
});

test("separa concatenacao apenas quando existe uma divisao segura", () => {
  const result = normalizeBrazilianPhone("27333344442733335555");
  assert.deepEqual(
    result.candidates.map((item) => item.canonical),
    ["552733334444", "552733335555"]
  );
  assert.equal(result.reason, "concatenated");
});

test("marca concatenacao ambigua sem escolher silenciosamente", () => {
  const result = normalizeBrazilianPhone("279999999927999999999");
  assert.equal(result.ambiguous, true);
  assert.deepEqual(result.candidates, []);
  assert.equal(canonicalPhone(result.original), null);
});

test("rejeita numero ausente ou implausivel", () => {
  assert.equal(canonicalPhone(""), null);
  assert.equal(canonicalPhone("12345"), null);
  assert.equal(canonicalPhone("(00) 0000-0000"), null);
});

test("formata CNPJ e preserva formato alfanumerico futuro", () => {
  assert.equal(displayCnpj("12.345.678/0001-95"), "12.345.678/0001-95");
  assert.equal(canonicalCnpj("12.345.678/0001-95"), "12345678000195");
  assert.equal(canonicalCnpj("ab.345.678/0001-cd"), "AB3456780001CD");
  assert.equal(displayCnpj("ab.345.678/0001-cd"), "AB3456780001CD");
  assert.equal(canonicalCnpj(null), null);
});
