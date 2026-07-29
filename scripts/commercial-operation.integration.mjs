import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { OperationService } from "../src/features/operation/services/operation-service.ts";
import {
  dialWithApi4Com,
  normalizeDialPhone,
} from "../src/features/operation/services/api4com-service.ts";
import { POST as api4ComWebhook } from "../src/app/api/integrations/api4com/webhook/route.ts";
import { AnalyticsService } from "../src/features/analytics/services/analytics-service.ts";

const ISOLATED_DATABASE_HOST =
  "ep-soft-sky-ac9ou8si-pooler.sa-east-1.aws.neon.tech";

function assertIsolatedDatabase() {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL ausente.");
  assert.equal(
    new URL(process.env.DATABASE_URL).hostname.toLowerCase(),
    ISOLATED_DATABASE_HOST,
    "Teste comercial bloqueado fora da branch Neon isolada."
  );
}

test("operação comercial é atômica, retomável e protegida de concorrência", async () => {
  assertIsolatedDatabase();
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const user2Id = `commercial-user-${suffix}`;
  let baseId;
  const companyIds = [];

  try {
    const user1 = await prisma.user.findFirst({
      where: { banned: false },
      select: { id: true },
    });
    assert.ok(user1, "A branch isolada precisa de um usuário ativo.");
    await prisma.user.create({
      data: {
        id: user2Id,
        name: "Operador sintético",
        email: `operador-${suffix}@example.invalid`,
      },
    });
    const base = await prisma.base.create({
      data: { name: `Operação sintética ${suffix}`, isActive: true },
    });
    baseId = base.id;
    for (const index of [1, 2]) {
      const company = await prisma.company.create({
        data: {
          corporateName: `Empresa sintética ${index} ${suffix}`,
          cnpj: null,
          city: "Vitória",
          state: "ES",
        },
      });
      companyIds.push(company.id);
      await prisma.baseCompany.create({
        data: { baseId, companyId: company.id },
      });
    }

    const idempotencyKey = randomUUID();
    const input = {
      userId: user1.id,
      baseId,
      companyId: companyIds[0],
      result: "SOLICITOU_RETORNO",
      nextStage: "EM_TENTATIVA",
      contactUsed: "27999990000",
      notes: "Registro sintético descartável",
      idempotencyKey,
      followUpAt: "2026-07-30T10:00",
      followUpReason: "Retorno sintético",
      view: "not-worked",
    };

    assert.deepEqual(await OperationService.saveInteraction(input), {
      duplicate: false,
    });
    const membership = await prisma.baseCompany.findUniqueOrThrow({
      where: {
        baseId_companyId: { baseId, companyId: companyIds[0] },
      },
    });
    assert.equal(membership.stage, "EM_TENTATIVA");
    assert.equal(membership.assignedUserId, user1.id);
    assert.equal(
      await prisma.salesInteraction.count({
        where: { baseId, companyId: companyIds[0] },
      }),
      1
    );
    assert.equal(
      await prisma.followUpTask.count({
        where: { baseId, companyId: companyIds[0], status: "PENDING" },
      }),
      1
    );
    const analytics = await AnalyticsService.getMetrics(
      {
        from: "2026-07-29",
        to: "2026-07-29",
        baseId,
        userId: user1.id,
      },
      user1.id
    );
    assert.equal(analytics.attempts, 1);
    assert.equal(analytics.uniqueCompanies, 1);
    assert.equal(analytics.followUpsScheduled, 1);
    assert.equal(analytics.stageCounts.EM_TENTATIVA, 1);
    assert.equal(
      (
        await prisma.operationCursor.findUniqueOrThrow({
          where: { userId_baseId: { userId: user1.id, baseId } },
        })
      ).currentCompanyId,
      companyIds[1]
    );

    assert.deepEqual(await OperationService.saveInteraction(input), {
      duplicate: true,
    });
    assert.equal(
      await prisma.salesInteraction.count({
        where: { baseId, companyId: companyIds[0] },
      }),
      1
    );
    assert.equal(
      await prisma.followUpTask.count({
        where: { baseId, companyId: companyIds[0] },
      }),
      1
    );

    await assert.rejects(
      OperationService.saveInteraction({
        ...input,
        userId: user2Id,
        idempotencyKey: randomUUID(),
      }),
      /COMPANY_ASSIGNED/
    );
    assert.equal(
      await prisma.salesInteraction.count({
        where: { baseId, companyId: companyIds[0] },
      }),
      1
    );

    const workspace = await OperationService.getWorkspace({
      userId: user1.id,
      baseId,
      view: "not-worked",
    });
    assert.equal(workspace.total, 1);
    assert.equal(workspace.current?.companyId, companyIds[1]);
    assert.equal(workspace.previous?.companyId, companyIds[0]);

    assert.equal(normalizeDialPhone("(27) 99999-0000"), "5527999990000");
    const originalFetch = globalThis.fetch;
    let dialRequest;
    globalThis.fetch = async (_url, options) => {
      dialRequest = JSON.parse(options.body);
      return Response.json({ id: "mock-call-id" });
    };
    try {
      assert.deepEqual(
        await dialWithApi4Com({
          config: { token: "fake-test-token", extension: "1001" },
          phone: "5527999990000",
          metadata: {
            gateway: "salescockpit",
            companyId: companyIds[1],
          },
        }),
        { id: "mock-call-id" }
      );
      assert.equal(dialRequest.phone, "5527999990000");
      assert.equal(dialRequest.metadata.companyId, companyIds[1]);
    } finally {
      globalThis.fetch = originalFetch;
    }

    const apiInteraction = await prisma.salesInteraction.create({
      data: {
        companyId: companyIds[1],
        baseId,
        userId: user1.id,
        previousStage: "NOVA",
        nextStage: "NOVA",
        origin: "API4COM",
        idempotencyKey: randomUUID(),
        externalCallId: "webhook-call-id",
      },
    });
    const webhookSecret = `secret-${suffix}`;
    process.env.API4COM_WEBHOOK_SECRET = webhookSecret;
    const webhookBody = {
      id: "webhook-call-id",
      startedAt: "2026-07-29T12:00:00.000Z",
      answeredAt: "2026-07-29T12:00:05.000Z",
      endedAt: "2026-07-29T12:01:00.000Z",
      duration: 55,
      hangupCause: "NORMAL_CLEARING",
      metadata: {
        interactionId: apiInteraction.id,
        companyId: companyIds[1],
        baseId,
        userId: user1.id,
      },
    };
    const webhookRequest = () =>
      new Request("http://localhost/api/integrations/api4com/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api4com-webhook-secret": webhookSecret,
        },
        body: JSON.stringify(webhookBody),
      });
    assert.equal((await api4ComWebhook(webhookRequest())).status, 200);
    const afterFirstWebhook = await prisma.salesInteraction.findUniqueOrThrow({
      where: { id: apiInteraction.id },
    });
    assert.equal(afterFirstWebhook.durationSeconds, 55);
    assert.equal((await api4ComWebhook(webhookRequest())).status, 200);
    const afterRepeatedWebhook =
      await prisma.salesInteraction.findUniqueOrThrow({
        where: { id: apiInteraction.id },
      });
    assert.equal(
      afterRepeatedWebhook.updatedAt.getTime(),
      afterFirstWebhook.updatedAt.getTime()
    );
  } finally {
    delete process.env.API4COM_WEBHOOK_SECRET;
    if (baseId) {
      await prisma.followUpTask.deleteMany({ where: { baseId } });
      await prisma.salesInteraction.deleteMany({ where: { baseId } });
      await prisma.operationCursor.deleteMany({ where: { baseId } });
      await prisma.baseCompany.deleteMany({ where: { baseId } });
      await prisma.base.deleteMany({ where: { id: baseId } });
    }
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.user.deleteMany({ where: { id: user2Id } });
    await prisma.$disconnect();
  }
});
