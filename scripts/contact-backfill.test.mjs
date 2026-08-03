import test from "node:test";
import assert from "node:assert/strict";

import { planCompanyContactBackfill } from "../src/features/companies/lib/contact-backfill.ts";

const company = {
  id: "company-1",
  phone: "(27) 99921-4489",
  email: "Contato@Exemplo.com.br",
};

test("planeja contatos individuais preservando os valores originais", () => {
  const plan = planCompanyContactBackfill(company, []);
  assert.deepEqual(
    plan.creates.map((item) => ({
      type: item.type,
      canonicalValue: item.canonicalValue,
      originalValue: item.originalValue,
      isPrimary: item.isPrimary,
    })),
    [
      {
        type: "PHONE",
        canonicalValue: "5527999214489",
        originalValue: "(27) 99921-4489",
        isPrimary: true,
      },
      {
        type: "EMAIL",
        canonicalValue: "contato@exemplo.com.br",
        originalValue: "Contato@Exemplo.com.br",
        isPrimary: true,
      },
    ]
  );
});

test("segunda execução é idempotente", () => {
  const first = planCompanyContactBackfill(company, []);
  const materialized = first.creates.map((item, index) => ({
    id: `contact-${index}`,
    type: item.type,
    value: item.value,
    originalValue: item.originalValue,
    canonicalValue: item.canonicalValue,
    isPrimary: item.isPrimary,
    archivedAt: null,
  }));
  const second = planCompanyContactBackfill(company, materialized);
  assert.equal(second.creates.length, 0);
  assert.equal(second.updates.length, 0);
});

test("contato existente recebe canônico sem perder o original", () => {
  const plan = planCompanyContactBackfill(
    { ...company, email: null },
    [
      {
        id: "contact-1",
        type: "PHONE",
        value: "(27) 99921-4489",
        originalValue: null,
        canonicalValue: null,
        isPrimary: false,
        archivedAt: null,
      },
    ]
  );
  assert.deepEqual(plan.creates, []);
  assert.deepEqual(plan.updates, [
    {
      contactId: "contact-1",
      originalValue: "(27) 99921-4489",
      canonicalValue: "5527999214489",
    },
  ]);
});

test("valor ambíguo é separado para revisão", () => {
  const plan = planCompanyContactBackfill(
    { id: "company-2", phone: "279999999927999999999", email: null },
    []
  );
  assert.equal(plan.creates.length, 0);
  assert.deepEqual(plan.ambiguities, [
    { companyId: "company-2", field: "company-phone" },
  ]);
});
