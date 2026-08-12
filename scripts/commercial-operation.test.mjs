import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  CommercialStage,
  CompanyQualification,
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
  assert.deepEqual(where.AND, [
    {
      OR: [
        { qualification: null },
        { qualification: CompanyQualification.EM_OPERACAO },
      ],
    },
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

test("fila congelada usa a qualificação, não um estágio paralelo", () => {
  const where = buildQueueWhere({
    baseId: "base-1",
    userId: "user-1",
    view: "frozen",
  });
  assert.equal(where.qualification, CompanyQualification.CONGELADA);
  assert.equal(where.stage, undefined);
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
    contactUsed: "(27) 99999-0000",
    nextStage: "EM_TENTATIVA",
    qualification: "EM_OPERACAO",
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

test("classificação escolhida no atendimento é validada junto com a interação", () => {
  const base = {
    baseId: "base-1",
    companyId: "company-1",
    result: "SEM_RESPOSTA",
    contactUsed: "(27) 99999-0000",
    nextStage: "EM_TENTATIVA",
    idempotencyKey: "a5682d8d-0681-41dc-a07d-986dfb249563",
    view: "not-worked",
  };
  assert.equal(
    saveInteractionSchema.safeParse({
      ...base,
      qualification: "ATUALIZAR_CONTATO",
    }).success,
    true
  );
  assert.equal(
    saveInteractionSchema.safeParse({
      ...base,
      qualification: "PERDIDA",
    }).success,
    false
  );
  assert.equal(
    saveInteractionSchema.safeParse({
      ...base,
      qualification: "PERDIDA",
      qualificationReason: "Não atua no perfil definido",
    }).success,
    true
  );
});

test("retorno exige data e motivo juntos", () => {
  const base = {
    baseId: "base-1",
    companyId: "company-1",
    result: "SOLICITOU_RETORNO",
    contactUsed: "(27) 99999-0000",
    nextStage: "CONTATO_REALIZADO",
    qualification: "EM_OPERACAO",
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
  assert.match(source, /input\.view === "returns-today"/);
  assert.match(source, /input\.view === "overdue"/);
  assert.match(source, /followUpTask\.updateMany/);
  assert.match(source, /status: "COMPLETED"/);
  assert.match(source, /completedAt: interaction\.createdAt/);
});

test("classificação acompanha o atendimento e também aceita decisão sem contato", () => {
  const source = fs.readFileSync(
    "src/features/operation/services/operation-service.ts",
    "utf8"
  );
  const workspace = fs.readFileSync(
    "src/features/operation/components/operation-workspace.tsx",
    "utf8"
  );
  assert.match(source, /qualification: nextQualification/);
  assert.match(source, /qualificationReason: nextQualificationReason/);
  assert.match(source, /baseCompanyChange\.create/);
  assert.match(workspace, /name="qualification"/);
  assert.match(workspace, /form="operation-interaction-form"/);
  assert.match(workspace, /Salvar decisão sem atendimento/);
  assert.match(workspace, /formAction=\{updateCompanyQualification\}/);
  assert.match(workspace, /formNoValidate/);
});

test("decisão sem atendimento atualiza apenas a qualificação", () => {
  const actions = fs.readFileSync(
    "src/features/operation/actions/operation-actions.ts",
    "utf8"
  );
  const start = actions.indexOf("export async function updateCompanyQualification");
  const end = actions.indexOf("export async function recordCommunicationEvent", start);
  const qualificationAction = actions.slice(start, end);
  assert.match(qualificationAction, /OperationService\.updateQualification/);
  assert.match(qualificationAction, /formData\.get\("qualificationReason"\)/);
  assert.doesNotMatch(qualificationAction, /saveInteraction|recordCommunication/);
});

test("Operação gerencia ficha principal e situações individuais dos telefones", () => {
  const panel = fs.readFileSync(
    "src/features/operation/components/operation-contact-panel.tsx",
    "utf8"
  );
  const service = fs.readFileSync(
    "src/features/companies/services/company-contact-service.ts",
    "utf8"
  );
  assert.match(panel, /Organizar contatos da ficha/);
  assert.match(panel, /legacyPhone/);
  assert.match(panel, /Principal da ficha/);
  assert.match(panel, /Editar contato principal/);
  assert.match(panel, /Editar telefones e contatos/);
  assert.match(panel, /open=\{isLegacyContact \|\| undefined\}/);
  assert.match(service, /responsibleName: company\.contactName/);
  for (const intent of [
    "invalid_unavailable",
    "invalid_out_of_service",
    "invalid_third_party",
  ]) {
    assert.match(panel, new RegExp(intent));
    assert.match(service, new RegExp(intent));
  }
  assert.match(service, /source: "FICHA_PRINCIPAL"/);
  assert.match(service, /mirrorsLegacy/);
  assert.match(service, /companyContactEvent\.create/);
});

test("chaves idempotentes são criadas no servidor sem divergência de hidratação", () => {
  const pageSource = fs.readFileSync(
    "src/app/(dashboard)/operacao/page.tsx",
    "utf8"
  );
  const workspaceSource = fs.readFileSync(
    "src/features/operation/components/operation-workspace.tsx",
    "utf8"
  );

  assert.match(pageSource, /idempotencyKey=\{randomUUID\(\)\}/);
  assert.match(pageSource, /callIdempotencyKey=\{randomUUID\(\)\}/);
  assert.doesNotMatch(workspaceSource, /crypto\.randomUUID\(\)/);
  assert.match(
    workspaceSource,
    /name="idempotencyKey"\s+value=\{idempotencyKey\}/
  );
  assert.match(
    workspaceSource,
    /name="idempotencyKey"\s+value=\{callIdempotencyKey\}/
  );
});

test("controles de navegação não criam formulários aninhados", () => {
  const source = fs.readFileSync(
    "src/features/operation/components/operation-workspace.tsx",
    "utf8"
  );
  const interactionFormStart = source.indexOf(
    'id="operation-interaction-form"'
  );
  const interactionFormEnd = source.indexOf("</form>", interactionFormStart);
  const cursorStart = source.indexOf("<CursorButton", interactionFormStart);

  assert.ok(interactionFormStart >= 0);
  assert.ok(interactionFormEnd > interactionFormStart);
  assert.ok(cursorStart > interactionFormEnd);
  assert.match(source, /form="operation-interaction-form"/);
});

test("movimentação do cursor atualiza a empresa exibida", () => {
  const source = fs.readFileSync(
    "src/features/operation/actions/operation-actions.ts",
    "utf8"
  );

  assert.match(source, /import \{ refresh, revalidatePath \} from "next\/cache"/);
  assert.match(
    source,
    /await OperationService\.moveCursor\([\s\S]+revalidatePath\("\/operacao"\);\s+refresh\(\);/
  );
});

test("shell e Operação limitam o painel ao viewport no desktop", () => {
  const shellSource = fs.readFileSync(
    "src/components/layout/app-shell.tsx",
    "utf8"
  );
  const pageSource = fs.readFileSync(
    "src/app/(dashboard)/operacao/page.tsx",
    "utf8"
  );
  const workspaceSource = fs.readFileSync(
    "src/features/operation/components/operation-workspace.tsx",
    "utf8"
  );

  assert.match(shellSource, /lg:h-dvh lg:min-h-0 lg:overflow-hidden/);
  assert.match(shellSource, /flex min-h-0 min-w-0 flex-1 flex-col/);
  assert.match(
    shellSource,
    /min-h-0 min-w-0 flex-1 overflow-y-auto/
  );
  assert.match(pageSource, /lg:h-full lg:overflow-hidden/);
  assert.match(workspaceSource, /lg:min-h-0 lg:flex-1/);
  assert.match(workspaceSource, /lg:overflow-hidden/);
  assert.match(workspaceSource, /lg:overflow-y-auto/);
  assert.match(
    workspaceSource,
    /grid min-h-0 flex-1 content-start gap-3 overflow-y-auto/
  );
  assert.match(
    workspaceSource,
    /form="operation-interaction-form"\s+className="bg-blue-600/
  );
});
