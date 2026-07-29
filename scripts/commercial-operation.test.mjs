import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  CommercialStage,
  FollowUpStatus,
} from "@prisma/client";

import {
  buildQueueWhere,
  getBusinessDayRange,
} from "../src/features/operation/lib/queue-filter.ts";
import {
  parseBusinessDateTime,
} from "../src/features/operation/lib/business-time.ts";
import { saveInteractionSchema } from "../src/features/operation/validations/operation-schema.ts";
import { calculateCompanyCompleteness } from "../src/features/companies/lib/company-completeness.ts";

test("fila não trabalhada respeita base, usuário e estágio inicial", () => {
  const where = buildQueueWhere({
    baseId: "base-1",
    userId: "user-1",
    view: "not-worked",
  });

  assert.equal(where.baseId, "base-1");
  assert.equal(where.stage, CommercialStage.NOVA);
  assert.deepEqual(where.OR, [
    { assignedUserId: null },
    { assignedUserId: "user-1" },
  ]);
});

test("retornos de hoje usam intervalo fechado-aberto do dia local", () => {
  const now = new Date("2026-07-29T14:00:00-03:00");
  const { start, end } = getBusinessDayRange(now);
  const where = buildQueueWhere({
    baseId: "base-1",
    userId: "user-1",
    view: "returns-today",
    now,
  });
  const followUp =
    where.company.followUps.some;

  assert.equal(start.toISOString(), "2026-07-29T03:00:00.000Z");
  assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
  assert.equal(followUp.status, FollowUpStatus.PENDING);
  assert.equal(followUp.baseId, "base-1");
  assert.equal(followUp.userId, "user-1");
  assert.deepEqual(followUp.dueAt, { gte: start, lt: end });
});

test("data local de retorno é persistida no horário de Vitória", () => {
  assert.equal(
    parseBusinessDateTime("2026-07-30T10:00").toISOString(),
    "2026-07-30T13:00:00.000Z"
  );
});

test("interação exige resultado, estágio e chave idempotente", () => {
  const valid = {
    baseId: "base-1",
    companyId: "company-1",
    result: "SEM_RESPOSTA",
    nextStage: "EM_TENTATIVA",
    idempotencyKey: "a5682d8d-0681-41dc-a07d-986dfb249563",
    view: "not-worked",
  };

  assert.equal(saveInteractionSchema.safeParse(valid).success, true);
  assert.equal(
    saveInteractionSchema.safeParse({ ...valid, idempotencyKey: "repetir" })
      .success,
    false
  );
});

test("retorno exige data e motivo juntos", () => {
  const base = {
    baseId: "base-1",
    companyId: "company-1",
    result: "SOLICITOU_RETORNO",
    nextStage: "CONTATO_REALIZADO",
    idempotencyKey: "a5682d8d-0681-41dc-a07d-986dfb249563",
    view: "not-worked",
  };

  assert.equal(
    saveInteractionSchema.safeParse({
      ...base,
      followUpAt: "2026-07-30T10:00",
    }).success,
    false
  );
  assert.equal(
    saveInteractionSchema.safeParse({
      ...base,
      followUpAt: "2026-07-30T10:00",
      followUpReason: "Retornar conforme solicitado",
    }).success,
    true
  );
});

test("migration comercial é aditiva e preserva Company e BaseCompany", () => {
  const sql = fs.readFileSync(
    "prisma/migrations/20260729113000_add_commercial_operation/migration.sql",
    "utf8"
  );

  assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN)\b/i);
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i);
  assert.match(
    sql,
    /ADD COLUMN "stage" "CommercialStage" NOT NULL DEFAULT 'NOVA'/
  );
  assert.match(sql, /CREATE TABLE "SalesInteraction"/);
  assert.match(sql, /CREATE TABLE "FollowUpTask"/);
  assert.match(sql, /CREATE TABLE "CompanyContact"/);
  assert.match(sql, /CREATE TABLE "OperationCursor"/);
});

test("completude usa somente dados efetivamente presentes", () => {
  assert.equal(
    calculateCompanyCompleteness({
      corporateName: "Empresa",
      cnpj: "123",
      segment: null,
      city: "Vitória",
      state: "ES",
      phone: null,
      email: null,
      website: null,
      contactCount: 1,
    }),
    57
  );
});

test("serviço usa idempotência e atualização otimista dentro da transação", () => {
  const source = fs.readFileSync(
    "src/features/operation/services/operation-service.ts",
    "utf8"
  );

  assert.match(source, /prisma\.\$transaction\(async \(tx\)/);
  assert.match(source, /idempotencyKey: input\.idempotencyKey/);
  assert.match(source, /tx\.baseCompany\.updateMany/);
  assert.match(source, /stage: membership\.stage/);
  assert.match(source, /updated\.count !== 1/);
});
