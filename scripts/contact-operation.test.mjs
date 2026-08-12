import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  communicationEventSchema,
  correctInteractionSchema,
  saveInteractionSchema,
} from "../src/features/operation/validations/operation-schema.ts";

test("tentativa exige o telefone efetivamente utilizado", () => {
  const result = saveInteractionSchema.safeParse({
    baseId: "base-1",
    companyId: "company-1",
    result: "SEM_RESPOSTA",
    nextStage: "EM_TENTATIVA",
    qualification: "EM_OPERACAO",
    idempotencyKey: "b614653f-5c5a-49b7-a328-f7d4b499ef75",
    view: "not-worked",
  });
  assert.equal(result.success, false);
});

test("resultado de comunicação precisa corresponder ao canal", () => {
  const base = {
    baseId: "base-1",
    companyId: "company-1",
    contactUsed: "contato@example.org",
  };
  assert.equal(
    communicationEventSchema.safeParse({
      ...base,
      channel: "EMAIL",
      result: "EMAIL_PREPARADO",
    }).success,
    true
  );
  assert.equal(
    communicationEventSchema.safeParse({
      ...base,
      channel: "EMAIL",
      result: "WHATSAPP_ENVIADO",
    }).success,
    false
  );
});

test("correção de resultado exige motivo auditável", () => {
  const base = {
    companyId: "company-1",
    interactionId: "interaction-1",
    correctedResult: "ATENDEU",
  };
  assert.equal(
    correctInteractionSchema.safeParse({ ...base, reason: "Correção do operador" })
      .success,
    true
  );
  assert.equal(
    correctInteractionSchema.safeParse({ ...base, reason: "" }).success,
    false
  );
});

test("migration é transacional, aditiva e protege contatos principais", () => {
  const sql = fs.readFileSync(
    "prisma/migrations/20260803120000_add_contact_qualification_audit/migration.sql",
    "utf8"
  );
  assert.match(sql, /^BEGIN;/);
  assert.match(sql, /COMMIT;\s*$/);
  assert.match(sql, /CompanyContact_active_phone_canonical_key/);
  assert.match(sql, /CompanyContact_active_primary_phone_key/);
  assert.match(sql, /CompanyContact_active_primary_email_key/);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|TRUNCATE/i);
});

test("invalidação da chamada altera somente o contato selecionado", () => {
  const service = fs.readFileSync(
    "src/features/operation/services/operation-service.ts",
    "utf8"
  );
  assert.match(service, /where:\s*\{ id: selectedContact\.id \}/);
  assert.match(service, /input\.result === "NUMERO_ERRADO"/);
  assert.match(service, /input\.result === "NUMERO_INEXISTENTE"/);
  assert.doesNotMatch(service, /SEM_RESPOSTA[\s\S]{0,120}validity:\s*"INVALID"/);
});

test("último telefone inválido classifica o vínculo para atualização de contato", () => {
  const service = fs.readFileSync(
    "src/features/operation/services/operation-service.ts",
    "utf8"
  );
  assert.match(service, /usablePhones === 0/);
  assert.match(service, /recommendContactUpdate = true/);
  assert.match(service, /shouldAutomaticallyQualifyForContactUpdate/);
  assert.match(service, /\("ATUALIZAR_CONTATO" as const\)/);
  assert.match(service, /type:\s*"QUALIFICATION_CHANGED"/);
  assert.match(service, /userChangedQualification/);
  assert.match(service, /input\.qualification/);
});

test("Empresas abre diretamente a empresa e preserva retorno", () => {
  const page = fs.readFileSync("src/app/(dashboard)/empresas/page.tsx", "utf8");
  const operationPage = fs.readFileSync(
    "src/app/(dashboard)/operacao/page.tsx",
    "utf8"
  );
  assert.match(page, /companyId=\$\{company\.id\}/);
  assert.match(page, /returnTo=/);
  assert.match(operationPage, /companyId:\s*params\.companyId/);
});
