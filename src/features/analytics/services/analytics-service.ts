import {
  CommercialStage,
  ContactType,
  ContactValidity,
  InteractionResult,
  Prisma,
} from "@prisma/client";
import "server-only";

import { prisma } from "@/lib/prisma";
import {
  buildInteractionWhere,
  buildMembershipWhere,
  parseDateRange,
  type AnalyticsFilters,
} from "../lib/report-filters";
import { CompanyService } from "@/features/companies/services/company-service";

const ANSWERED_RESULTS = [
  InteractionResult.PESSOA_ERRADA,
  InteractionResult.RECEPCAO,
  InteractionResult.RESPONSAVEL_INDISPONIVEL,
  InteractionResult.SOLICITOU_RETORNO,
  InteractionResult.FALOU_COM_RESPONSAVEL,
  InteractionResult.SEM_INTERESSE,
  InteractionResult.EMPRESA_INADEQUADA,
  InteractionResult.EMPRESA_QUALIFICADA,
  InteractionResult.REUNIAO_AGENDADA,
];

const RESPONSIBLE_RESULTS = [
  InteractionResult.SOLICITOU_RETORNO,
  InteractionResult.FALOU_COM_RESPONSAVEL,
  InteractionResult.SEM_INTERESSE,
  InteractionResult.EMPRESA_QUALIFICADA,
  InteractionResult.REUNIAO_AGENDADA,
];

export class AnalyticsService {
  static async getFilterOptions(includeUsers: boolean) {
    const [bases, users] = await Promise.all([
      prisma.base.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      includeUsers
        ? prisma.user.findMany({
            where: { banned: false },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
    ]);
    return { bases, users };
  }

  static async getMetrics(
    filters: AnalyticsFilters,
    permittedUserId?: string
  ) {
    const interactionWhere = buildInteractionWhere(filters, permittedUserId);
    const membershipWhere = buildMembershipWhere(filters, permittedUserId);
    const companyDataWhere = CompanyService.buildWhere({
      query: filters.query,
      city: filters.city,
      state: filters.state,
      segment: filters.segment,
    });
    const range = parseDateRange(filters.from, filters.to);
    const selectedUserId = permittedUserId ?? filters.userId;
    const followUpWhere: Prisma.FollowUpTaskWhereInput = {
      ...(selectedUserId ? { userId: selectedUserId } : {}),
      ...(filters.baseId ? { baseId: filters.baseId } : {}),
    };
    const contactWhere: Prisma.CompanyContactWhereInput = {
      ...(selectedUserId ? { createdByUserId: selectedUserId } : {}),
      company: companyDataWhere,
      ...(filters.baseId
        ? {
            company: {
              ...companyDataWhere,
              bases: { some: { baseId: filters.baseId } },
            },
          }
        : {}),
    };
    const companyWhere: Prisma.CompanyWhereInput = {
      ...companyDataWhere,
      ...(filters.baseId || selectedUserId
        ? {
            bases: {
              some: {
                ...(filters.baseId ? { baseId: filters.baseId } : {}),
                ...(selectedUserId ? { assignedUserId: selectedUserId } : {}),
              },
            },
          }
        : {}),
    };

    const [
      attempts,
      uniqueCompanies,
      answered,
      responsibleConversations,
      invalidNumbers,
      duration,
      followUpsScheduled,
      followUpsPending,
      followUpsOverdue,
      stages,
      contactsAdded,
      contactsValidated,
      contactsInvalidated,
      dataChanges,
      dataChangeAverage,
      companiesWithPhone,
      companiesWithEmail,
      companiesWithWebsite,
      companiesWithSocial,
    ] = await Promise.all([
      prisma.salesInteraction.count({ where: interactionWhere }),
      prisma.salesInteraction.groupBy({
        by: ["companyId"],
        where: interactionWhere,
      }),
      prisma.salesInteraction.count({
        where: {
          AND: [interactionWhere, { result: { in: ANSWERED_RESULTS } }],
        },
      }),
      prisma.salesInteraction.count({
        where: {
          AND: [interactionWhere, { result: { in: RESPONSIBLE_RESULTS } }],
        },
      }),
      prisma.salesInteraction.count({
        where: {
          AND: [
            interactionWhere,
            { result: InteractionResult.NUMERO_INVALIDO },
          ],
        },
      }),
      prisma.salesInteraction.aggregate({
        where: interactionWhere,
        _sum: { durationSeconds: true },
      }),
      prisma.followUpTask.count({
        where: {
          ...followUpWhere,
          createdAt: { gte: range.start, lt: range.end },
        },
      }),
      prisma.followUpTask.count({
        where: { ...followUpWhere, status: "PENDING" },
      }),
      prisma.followUpTask.count({
        where: {
          ...followUpWhere,
          status: "PENDING",
          dueAt: { lt: new Date() },
        },
      }),
      prisma.baseCompany.groupBy({
        by: ["stage"],
        where: membershipWhere,
        _count: true,
      }),
      prisma.companyContact.count({
        where: {
          ...contactWhere,
          createdAt: { gte: range.start, lt: range.end },
        },
      }),
      prisma.companyContact.count({
        where: {
          ...contactWhere,
          validity: ContactValidity.VALID,
          validatedAt: { gte: range.start, lt: range.end },
        },
      }),
      prisma.companyContact.count({
        where: {
          ...contactWhere,
          validity: ContactValidity.INVALID,
          validatedAt: { gte: range.start, lt: range.end },
        },
      }),
      prisma.companyDataChange.groupBy({
        by: ["companyId"],
        where: {
          ...(selectedUserId ? { userId: selectedUserId } : {}),
          ...(filters.baseId
            ? { company: { bases: { some: { baseId: filters.baseId } } } }
            : {}),
          createdAt: { gte: range.start, lt: range.end },
        },
      }),
      prisma.companyDataChange.aggregate({
        where: {
          ...(selectedUserId ? { userId: selectedUserId } : {}),
          createdAt: { gte: range.start, lt: range.end },
        },
        _avg: {
          completenessBefore: true,
          completenessAfter: true,
        },
      }),
      prisma.company.count({
        where: {
          ...companyWhere,
          OR: [
            { phone: { not: null } },
            {
              contacts: {
                some: {
                  type: { in: [ContactType.PHONE, ContactType.WHATSAPP] },
                  validity: { not: ContactValidity.INVALID },
                },
              },
            },
          ],
        },
      }),
      prisma.company.count({
        where: {
          ...companyWhere,
          OR: [
            { email: { not: null } },
            {
              contacts: {
                some: {
                  type: ContactType.EMAIL,
                  validity: { not: ContactValidity.INVALID },
                },
              },
            },
          ],
        },
      }),
      prisma.company.count({
        where: {
          ...companyWhere,
          OR: [
            { website: { not: null } },
            {
              contacts: {
                some: {
                  type: ContactType.WEBSITE,
                  validity: { not: ContactValidity.INVALID },
                },
              },
            },
          ],
        },
      }),
      prisma.company.count({
        where: {
          ...companyWhere,
          contacts: {
            some: {
              type: ContactType.INSTAGRAM,
              validity: { not: ContactValidity.INVALID },
            },
          },
        },
      }),
    ]);

    const stageCounts = Object.fromEntries(
      Object.values(CommercialStage).map((stage) => [stage, 0])
    ) as Record<CommercialStage, number>;
    for (const item of stages) stageCounts[item.stage] = item._count;

    return {
      attempts,
      uniqueCompanies: uniqueCompanies.length,
      answered,
      responsibleConversations,
      invalidNumbers,
      durationSeconds: duration._sum.durationSeconds ?? 0,
      followUpsScheduled,
      followUpsPending,
      followUpsOverdue,
      stageCounts,
      contactsAdded,
      contactsValidated,
      contactsInvalidated,
      enrichedCompanies: dataChanges.length,
      completenessBefore:
        Math.round(dataChangeAverage._avg.completenessBefore ?? 0),
      completenessAfter:
        Math.round(dataChangeAverage._avg.completenessAfter ?? 0),
      companiesWithPhone,
      companiesWithEmail,
      companiesWithWebsite,
      companiesWithSocial,
    };
  }

  static async getInteractionPage({
    filters,
    permittedUserId,
    page = 1,
    pageSize = 25,
  }: {
    filters: AnalyticsFilters;
    permittedUserId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const where = buildInteractionWhere(filters, permittedUserId);
    const safePageSize = Math.min(500, Math.max(10, pageSize));
    const total = await prisma.salesInteraction.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const actualPage = Math.min(Math.max(1, page), totalPages);
    const rows = await prisma.salesInteraction.findMany({
      where,
      include: {
        company: { select: { id: true, cnpj: true, corporateName: true } },
        base: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        followUps: {
          where: { status: "PENDING" },
          orderBy: { dueAt: "asc" },
          take: 1,
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (actualPage - 1) * safePageSize,
      take: safePageSize,
    });
    return { rows, total, page: actualPage, pageSize: safePageSize, totalPages };
  }

  static async getCompanyPage({
    filters,
    permittedUserId,
    page = 1,
    pageSize = 25,
  }: {
    filters: AnalyticsFilters;
    permittedUserId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const dataWhere = CompanyService.buildWhere({
      query: filters.query,
      city: filters.city,
      state: filters.state,
      segment: filters.segment,
    });
    const completenessWhere: Prisma.CompanyWhereInput =
      filters.completeness === "with-phone"
        ? { phone: { not: null } }
        : filters.completeness === "with-email"
          ? { email: { not: null } }
          : filters.completeness === "with-site"
            ? { website: { not: null } }
            : filters.completeness === "incomplete"
              ? {
                  OR: [
                    { phone: null },
                    { email: null },
                    { website: null },
                    { segment: null },
                  ],
                }
              : {};
    const where: Prisma.CompanyWhereInput = {
      AND: [
        dataWhere,
        completenessWhere,
        {
          bases: {
            some: {
              ...(filters.baseId ? { baseId: filters.baseId } : {}),
              ...(permittedUserId ?? filters.userId
                ? { assignedUserId: permittedUserId ?? filters.userId }
                : {}),
              ...(filters.stage ? { stage: filters.stage } : {}),
            },
          },
        },
      ],
    };
    const safePageSize = Math.min(500, Math.max(10, pageSize));
    const total = await prisma.company.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const actualPage = Math.min(Math.max(1, page), totalPages);
    const rows = await prisma.company.findMany({
      where,
      include: {
        bases: {
          where: {
            ...(filters.baseId ? { baseId: filters.baseId } : {}),
            ...(permittedUserId ?? filters.userId
              ? { assignedUserId: permittedUserId ?? filters.userId }
              : {}),
          },
          include: {
            base: { select: { id: true, name: true } },
            assignedUser: { select: { id: true, name: true } },
          },
          orderBy: { base: { name: "asc" } },
        },
        interactions: {
          where: buildInteractionWhere(filters, permittedUserId),
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        followUps: {
          where: {
            ...(permittedUserId ?? filters.userId
              ? { userId: permittedUserId ?? filters.userId }
              : {}),
            ...(filters.baseId ? { baseId: filters.baseId } : {}),
            ...(filters.followUpStatus
              ? { status: filters.followUpStatus }
              : { status: "PENDING" }),
          },
          orderBy: { dueAt: "asc" },
          take: 1,
        },
      },
      orderBy: [{ corporateName: "asc" }, { id: "asc" }],
      skip: (actualPage - 1) * safePageSize,
      take: safePageSize,
    });
    return { rows, total, page: actualPage, pageSize: safePageSize, totalPages };
  }
}
