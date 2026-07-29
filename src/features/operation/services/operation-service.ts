import { Prisma } from "@prisma/client";
import "server-only";
import type { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { OperationView } from "../constants";
import { COMMERCIAL_STAGE_LABELS } from "../constants";
import { parseBusinessDateTime } from "../lib/business-time";
import { buildQueueWhere } from "../lib/queue-filter";
import type { saveInteractionSchema } from "../validations/operation-schema";

type SaveInteractionInput = z.infer<typeof saveInteractionSchema> & {
  userId: string;
};

const companyInclude = {
  company: {
    include: {
      contacts: {
        orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
      },
      followUps: {
        where: { status: "PENDING" as const },
        orderBy: { dueAt: "asc" as const },
        take: 5,
      },
      interactions: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" as const },
        take: 10,
      },
    },
  },
} satisfies Prisma.BaseCompanyInclude;

export class OperationService {
  static async getWorkspace({
    userId,
    baseId,
    view,
  }: {
    userId: string;
    baseId?: string;
    view: OperationView;
  }) {
    const bases = await prisma.base.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        companiesCount: true,
        operationScript: true,
      },
      orderBy: { name: "asc" },
    });
    const selectedBaseId =
      bases.find((base) => base.id === baseId)?.id ?? bases[0]?.id ?? null;

    if (!selectedBaseId) {
      return {
        bases,
        selectedBaseId,
        queue: [],
        total: 0,
        current: null,
        previous: null,
      };
    }

    const where = buildQueueWhere({ baseId: selectedBaseId, userId, view });
    const [queue, total, cursor] = await Promise.all([
      prisma.baseCompany.findMany({
        where,
        include: companyInclude,
        orderBy: [
          { lastInteractionAt: { sort: "asc", nulls: "first" } },
          { company: { corporateName: "asc" } },
          { companyId: "asc" },
        ],
        take: 50,
      }),
      prisma.baseCompany.count({ where }),
      prisma.operationCursor.findUnique({
        where: { userId_baseId: { userId, baseId: selectedBaseId } },
      }),
    ]);
    const cursorCurrent = cursor?.currentCompanyId
      ? (queue.find(
          (item) => item.companyId === cursor.currentCompanyId
        ) ??
        (await prisma.baseCompany.findFirst({
          where: {
            baseId: selectedBaseId,
            companyId: cursor.currentCompanyId,
            OR: [{ assignedUserId: null }, { assignedUserId: userId }],
          },
          include: companyInclude,
        })))
      : null;
    const current = cursorCurrent ?? queue[0] ?? null;
    const previous =
      cursor?.previousCompanyId &&
      cursor.previousCompanyId !== current?.companyId
        ? await prisma.baseCompany.findFirst({
            where: {
              baseId: selectedBaseId,
              companyId: cursor.previousCompanyId,
              OR: [{ assignedUserId: null }, { assignedUserId: userId }],
            },
            include: companyInclude,
          })
        : null;

    return { bases, selectedBaseId, queue, total, current, previous };
  }

  static async saveInteraction(input: SaveInteractionInput) {
    try {
      return await prisma.$transaction(async (tx) => {
        const duplicate = await tx.salesInteraction.findUnique({
          where: { dispositionKey: input.idempotencyKey },
          select: { id: true },
        });
        if (duplicate) return { duplicate: true };

        const membership = await tx.baseCompany.findUnique({
          where: {
            baseId_companyId: {
              baseId: input.baseId,
              companyId: input.companyId,
            },
          },
          select: { stage: true, assignedUserId: true },
        });
        if (!membership) throw new Error("MEMBERSHIP_NOT_FOUND");
        if (
          membership.assignedUserId &&
          membership.assignedUserId !== input.userId
        ) {
          throw new Error("COMPANY_ASSIGNED");
        }

        const apiInteraction = input.apiInteractionId
          ? await tx.salesInteraction.findFirst({
              where: {
                id: input.apiInteractionId,
                baseId: input.baseId,
                companyId: input.companyId,
                userId: input.userId,
                origin: "API4COM",
                result: null,
              },
              select: { id: true, createdAt: true },
            })
          : null;
        const interaction = apiInteraction
          ? await tx.salesInteraction.update({
              where: { id: apiInteraction.id },
              data: {
                result: input.result,
                nextStage: input.nextStage,
                previousStage: membership.stage,
                contactUsed: input.contactUsed || null,
                notes: input.notes || null,
                dispositionKey: input.idempotencyKey,
              },
            })
          : await tx.salesInteraction.create({
              data: {
                baseId: input.baseId,
                companyId: input.companyId,
                userId: input.userId,
                result: input.result,
                nextStage: input.nextStage,
                previousStage: membership.stage,
                contactUsed: input.contactUsed || null,
                notes: input.notes || null,
                idempotencyKey: input.idempotencyKey,
                dispositionKey: input.idempotencyKey,
                startedAt: new Date(),
                endedAt: new Date(),
              },
            });

        const updated = await tx.baseCompany.updateMany({
          where: {
            baseId: input.baseId,
            companyId: input.companyId,
            stage: membership.stage,
            OR: [{ assignedUserId: null }, { assignedUserId: input.userId }],
          },
          data: {
            stage: input.nextStage,
            status: COMMERCIAL_STAGE_LABELS[input.nextStage],
            assignedUserId: input.userId,
            lastInteractionAt: interaction.createdAt,
          },
        });
        if (updated.count !== 1) throw new Error("CONCURRENT_UPDATE");

        if (input.followUpAt && input.followUpReason) {
          await tx.followUpTask.create({
            data: {
              baseId: input.baseId,
              companyId: input.companyId,
              userId: input.userId,
              interactionId: interaction.id,
              dueAt: parseBusinessDateTime(input.followUpAt),
              reason: input.followUpReason,
            },
          });
        }

        const where = buildQueueWhere({
          baseId: input.baseId,
          userId: input.userId,
          view: input.view as OperationView,
        });
        const next = await tx.baseCompany.findFirst({
          where: { ...where, companyId: { not: input.companyId } },
          orderBy: [
            { lastInteractionAt: { sort: "asc", nulls: "first" } },
            { company: { corporateName: "asc" } },
            { companyId: "asc" },
          ],
          select: { companyId: true },
        });
        await tx.operationCursor.upsert({
          where: {
            userId_baseId: { userId: input.userId, baseId: input.baseId },
          },
          create: {
            userId: input.userId,
            baseId: input.baseId,
            currentCompanyId: next?.companyId,
            previousCompanyId: input.companyId,
            view: input.view,
          },
          update: {
            currentCompanyId: next?.companyId,
            previousCompanyId: input.companyId,
            view: input.view,
          },
        });

        return { duplicate: false };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { duplicate: true };
      }
      throw error;
    }
  }

  static async moveCursor({
    userId,
    baseId,
    companyId,
    previousCompanyId,
    view,
  }: {
    userId: string;
    baseId: string;
    companyId: string | null;
    previousCompanyId?: string | null;
    view: OperationView;
  }) {
    if (companyId) {
      const membership = await prisma.baseCompany.findUnique({
        where: { baseId_companyId: { baseId, companyId } },
        select: { companyId: true },
      });
      if (!membership) throw new Error("MEMBERSHIP_NOT_FOUND");
    }
    return prisma.operationCursor.upsert({
      where: { userId_baseId: { userId, baseId } },
      create: {
        userId,
        baseId,
        currentCompanyId: companyId,
        previousCompanyId,
        view,
      },
      update: {
        currentCompanyId: companyId,
        previousCompanyId,
        view,
      },
    });
  }
}
