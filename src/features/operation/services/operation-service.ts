import { InteractionResult, Prisma } from "@prisma/client";
import "server-only";
import type { z } from "zod";

import { prisma } from "@/lib/prisma";
import { canonicalPhone } from "@/lib/phone-normalizer";
import type { OperationView } from "../constants";
import { COMMERCIAL_STAGE_LABELS } from "../constants";
import { parseBusinessDateTime } from "../lib/business-time";
import { buildQueueWhere } from "../lib/queue-filter";
import type { saveInteractionSchema } from "../validations/operation-schema";
import type {
  communicationEventSchema,
  updateQualificationSchema,
} from "../validations/operation-schema";

type SaveInteractionInput = z.infer<typeof saveInteractionSchema> & {
  userId: string;
};

type QualificationInput = z.infer<typeof updateQualificationSchema> & {
  userId: string;
};

type CommunicationInput = z.infer<typeof communicationEventSchema> & {
  userId: string;
  idempotencyKey: string;
};

type CorrectInteractionInput = {
  companyId: string;
  interactionId: string;
  correctedResult: InteractionResult;
  reason: string;
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
  static async correctLatestInteraction(input: CorrectInteractionInput) {
    return prisma.$transaction(async (tx) => {
      const latest = await tx.salesInteraction.findFirst({
        where: { companyId: input.companyId, result: { not: null } },
        orderBy: { createdAt: "desc" },
        include: {
          corrections: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { correctedResult: true },
          },
        },
      });
      if (!latest || latest.id !== input.interactionId) {
        throw new Error("INTERACTION_NOT_LATEST");
      }
      const previousResult =
        latest.corrections[0]?.correctedResult ?? latest.result;
      return tx.interactionCorrection.create({
        data: {
          interactionId: latest.id,
          userId: input.userId,
          previousResult,
          correctedResult: input.correctedResult,
          reason: input.reason,
        },
      });
    });
  }

  static async updateQualification(input: QualificationInput) {
    return prisma.$transaction(async (tx) => {
      const membership = await tx.baseCompany.findUnique({
        where: {
          baseId_companyId: {
            baseId: input.baseId,
            companyId: input.companyId,
          },
        },
        select: { qualification: true, qualificationReason: true },
      });
      if (!membership) throw new Error("MEMBERSHIP_NOT_FOUND");
      if (
        membership.qualification === input.qualification &&
        membership.qualificationReason === (input.reason || null)
      ) {
        return { unchanged: true };
      }

      await tx.baseCompany.update({
        where: {
          baseId_companyId: {
            baseId: input.baseId,
            companyId: input.companyId,
          },
        },
        data: {
          qualification: input.qualification,
          qualificationReason: input.reason || null,
        },
      });
      await tx.baseCompanyChange.create({
        data: {
          baseId: input.baseId,
          companyId: input.companyId,
          userId: input.userId,
          type: "QUALIFICATION_CHANGED",
          reason: input.reason,
          previousState: {
            qualification: membership.qualification,
            reason: membership.qualificationReason,
          },
          nextState: {
            qualification: input.qualification,
            reason: input.reason || null,
          },
        },
      });
      return { unchanged: false };
    });
  }

  static async recordCommunication(input: CommunicationInput) {
    return prisma.$transaction(async (tx) => {
      const membership = await tx.baseCompany.findUnique({
        where: {
          baseId_companyId: {
            baseId: input.baseId,
            companyId: input.companyId,
          },
        },
        select: { stage: true },
      });
      if (!membership) throw new Error("MEMBERSHIP_NOT_FOUND");
      const contact = input.contactId
        ? await tx.companyContact.findFirst({
            where: {
              id: input.contactId,
              companyId: input.companyId,
              archivedAt: null,
            },
            select: { id: true },
          })
        : null;
      if (input.contactId && !contact) throw new Error("CONTACT_NOT_FOUND");

      const notes = [
        input.subject ? `Assunto: ${input.subject}` : null,
        input.message || null,
      ]
        .filter(Boolean)
        .join("\n");
      return tx.salesInteraction.create({
        data: {
          baseId: input.baseId,
          companyId: input.companyId,
          userId: input.userId,
          contactId: contact?.id,
          channel: input.channel,
          contactUsed: input.contactUsed,
          result: input.result,
          notes: notes || null,
          previousStage: membership.stage,
          nextStage: membership.stage,
          idempotencyKey: input.idempotencyKey,
          dispositionKey: input.idempotencyKey,
          startedAt: new Date(),
          endedAt: new Date(),
        },
      });
    });
  }

  static async getWorkspace({
    userId,
    baseId,
    view,
    companyId,
  }: {
    userId: string;
    baseId?: string;
    view: OperationView;
    companyId?: string;
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
    const requestedCompany = companyId
      ? await prisma.baseCompany.findFirst({
          where: {
            baseId: selectedBaseId,
            companyId,
            OR: [{ assignedUserId: null }, { assignedUserId: userId }],
          },
          include: companyInclude,
        })
      : null;
    const current = requestedCompany ?? cursorCurrent ?? queue[0] ?? null;
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
          select: { stage: true, qualification: true, assignedUserId: true },
        });
        if (!membership) throw new Error("MEMBERSHIP_NOT_FOUND");
        if (
          membership.assignedUserId &&
          membership.assignedUserId !== input.userId
        ) {
          throw new Error("COMPANY_ASSIGNED");
        }

        let selectedContact = input.contactId
          ? await tx.companyContact.findFirst({
              where: {
                id: input.contactId,
                companyId: input.companyId,
                archivedAt: null,
              },
              select: {
                id: true,
                companyId: true,
                type: true,
                value: true,
                canonicalValue: true,
                isPrimary: true,
                isWhatsapp: true,
                validity: true,
                invalidReason: true,
                archivedAt: true,
              },
            })
          : null;
        if (input.contactId && !selectedContact) {
          throw new Error("CONTACT_NOT_FOUND");
        }
        const fallbackCanonical = !selectedContact
          ? canonicalPhone(input.contactUsed)
          : null;
        if (!selectedContact && fallbackCanonical && input.contactUsed) {
          selectedContact = await tx.companyContact.findFirst({
            where: {
              companyId: input.companyId,
              type: { in: ["PHONE", "WHATSAPP"] },
              archivedAt: null,
              OR: [
                { canonicalValue: fallbackCanonical },
                { value: input.contactUsed },
              ],
            },
            select: {
              id: true,
              companyId: true,
              type: true,
              value: true,
              canonicalValue: true,
              isPrimary: true,
              isWhatsapp: true,
              validity: true,
              invalidReason: true,
              archivedAt: true,
            },
          });
          if (selectedContact && !selectedContact.canonicalValue) {
            selectedContact = await tx.companyContact.update({
              where: { id: selectedContact.id },
              data: {
                canonicalValue: fallbackCanonical,
                originalValue: selectedContact.value,
              },
              select: {
                id: true,
                companyId: true,
                type: true,
                value: true,
                canonicalValue: true,
                isPrimary: true,
                isWhatsapp: true,
                validity: true,
                invalidReason: true,
                archivedAt: true,
              },
            });
          }
          if (!selectedContact) {
            selectedContact = await tx.companyContact.create({
              data: {
                companyId: input.companyId,
                type: "PHONE",
                value: input.contactUsed,
                originalValue: input.contactUsed,
                canonicalValue: fallbackCanonical,
                source: "OPERACAO",
                createdByUserId: input.userId,
              },
              select: {
                id: true,
                companyId: true,
                type: true,
                value: true,
                canonicalValue: true,
                isPrimary: true,
                isWhatsapp: true,
                validity: true,
                invalidReason: true,
                archivedAt: true,
              },
            });
            await tx.companyContactEvent.create({
              data: {
                contactId: selectedContact.id,
                companyId: input.companyId,
                userId: input.userId,
                type: "CREATED",
                reason: "Contato materializado a partir do telefone importado.",
                nextState: selectedContact,
              },
            });
          }
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
                contactId: selectedContact?.id ?? null,
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
                contactId: selectedContact?.id ?? null,
                contactUsed: input.contactUsed || null,
                notes: input.notes || null,
                idempotencyKey: input.idempotencyKey,
                dispositionKey: input.idempotencyKey,
                startedAt: new Date(),
                endedAt: new Date(),
              },
            });

        let shouldQualifyForContactUpdate = false;
        const invalidReason =
          input.result === "NUMERO_ERRADO"
            ? "WRONG_NUMBER"
            : input.result === "NUMERO_INEXISTENTE"
              ? "NONEXISTENT"
              : null;
        if (invalidReason && selectedContact) {
          const invalidatedAt = new Date();
          const updatedContact = await tx.companyContact.update({
            where: { id: selectedContact.id },
            data: {
              validity: "INVALID",
              invalidReason,
              invalidatedAt,
              invalidatedByUserId: input.userId,
              validatedAt: invalidatedAt,
              isPrimary: false,
            },
            select: {
              type: true,
              value: true,
              canonicalValue: true,
              isPrimary: true,
              isWhatsapp: true,
              validity: true,
              invalidReason: true,
              archivedAt: true,
            },
          });
          await tx.companyContactEvent.create({
            data: {
              contactId: selectedContact.id,
              companyId: input.companyId,
              userId: input.userId,
              type: "INVALIDATED",
              reason:
                invalidReason === "WRONG_NUMBER"
                  ? "Número errado"
                  : "Número inexistente",
              previousState: selectedContact,
              nextState: updatedContact,
            },
          });

          const usablePhones = await tx.companyContact.count({
            where: {
              companyId: input.companyId,
              type: { in: ["PHONE", "WHATSAPP"] },
              archivedAt: null,
              validity: { not: "INVALID" },
            },
          });
          if (usablePhones === 0) {
            shouldQualifyForContactUpdate =
              membership.qualification === null ||
              membership.qualification === "EM_OPERACAO";
            await tx.baseCompanyChange.create({
              data: {
                baseId: input.baseId,
                companyId: input.companyId,
                userId: input.userId,
                type: "CONTACT_UPDATE_RECOMMENDED",
                reason: "Nenhum telefone utilizável permanece cadastrado.",
                previousState: { qualification: membership.qualification },
                nextState: { suggestedQualification: "ATUALIZAR_CONTATO" },
              },
            });
          }
        }

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
            ...(shouldQualifyForContactUpdate
              ? {
                  qualification: "ATUALIZAR_CONTATO" as const,
                  qualificationReason:
                    "Nenhum telefone utilizável permanece cadastrado.",
                }
              : {}),
          },
        });
        if (updated.count !== 1) throw new Error("CONCURRENT_UPDATE");

        if (shouldQualifyForContactUpdate) {
          await tx.baseCompanyChange.create({
            data: {
              baseId: input.baseId,
              companyId: input.companyId,
              userId: input.userId,
              type: "QUALIFICATION_CHANGED",
              reason: "Nenhum telefone utilizável permanece cadastrado.",
              previousState: { qualification: membership.qualification },
              nextState: { qualification: "ATUALIZAR_CONTATO" },
            },
          });
        }

        if (membership.stage !== input.nextStage) {
          await tx.baseCompanyChange.create({
            data: {
              baseId: input.baseId,
              companyId: input.companyId,
              userId: input.userId,
              type: "STAGE_CHANGED",
              previousState: { stage: membership.stage },
              nextState: { stage: input.nextStage },
            },
          });
        }

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
