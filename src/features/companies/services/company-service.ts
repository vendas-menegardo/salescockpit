import {
  CommercialStage,
  CompanyQualification,
  ContactType,
  Prisma,
} from "@prisma/client";
import "server-only";

import { prisma } from "@/lib/prisma";
import { normalizeCnpj, normalizeText } from "@/features/import/lib/import-utils";

export type CompanyQuickView =
  | "all"
  | "contact-update"
  | "missing-phone"
  | "missing-email"
  | "missing-responsible"
  | "ready"
  | "pending-returns";

export type FindCompaniesInput = {
  query?: string;
  baseId?: string;
  city?: string;
  state?: string;
  segment?: string;
  completeness?: "all" | "incomplete" | "missing-phone" | "missing-email" | "missing-site";
  qualification?: CompanyQualification;
  stage?: CommercialStage;
  phoneStatus?: "has" | "missing" | "invalid";
  whatsapp?: "has";
  emailStatus?: "missing";
  responsible?: "has" | "missing";
  operationStatus?: "not-worked" | "worked" | "pending-return";
  lastInteractionFrom?: string;
  lastInteractionTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  quickView?: CompanyQuickView;
  page?: number;
  pageSize?: number;
};

export class CompanyService {
  static buildWhere({
    query,
    baseId,
    city,
    state,
    segment,
    completeness = "all",
    qualification,
    stage,
    phoneStatus,
    whatsapp,
    emailStatus,
    responsible,
    operationStatus,
    lastInteractionFrom,
    lastInteractionTo,
    updatedFrom,
    updatedTo,
    quickView,
  }: FindCompaniesInput = {}) {
    const normalizedQuery = normalizeText(query);
    const cnpjQuery = normalizeCnpj(query);
    const where: Prisma.CompanyWhereInput = {};

    const and: Prisma.CompanyWhereInput[] = [];
    if (normalizedQuery) {
      where.OR = [
        {
          corporateName: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
        {
          tradeName: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
        { phone: { contains: normalizedQuery, mode: "insensitive" } },
        { email: { contains: normalizedQuery, mode: "insensitive" } },
        { contactName: { contains: normalizedQuery, mode: "insensitive" } },
        {
          contacts: {
            some: {
              archivedAt: null,
              OR: [
                { value: { contains: normalizedQuery, mode: "insensitive" } },
                {
                  responsibleName: {
                    contains: normalizedQuery,
                    mode: "insensitive",
                  },
                },
              ],
            },
          },
        },
        ...(cnpjQuery
          ? [
              {
                cnpj: {
                  contains: cnpjQuery,
                },
              } satisfies Prisma.CompanyWhereInput,
            ]
          : []),
      ];
    }

    function dateRange(from?: string, to?: string) {
      const range: Prisma.DateTimeFilter = {};
      if (from) range.gte = new Date(`${from}T00:00:00-03:00`);
      if (to) range.lte = new Date(`${to}T23:59:59.999-03:00`);
      return Object.keys(range).length ? range : undefined;
    }

    const membershipFilter: Prisma.BaseCompanyWhereInput = {};
    if (baseId) membershipFilter.baseId = baseId;
    const effectiveQualification =
      quickView === "contact-update"
        ? CompanyQualification.ATUALIZAR_CONTATO
        : quickView === "ready"
          ? CompanyQualification.EM_OPERACAO
          : qualification;
    if (effectiveQualification) membershipFilter.qualification = effectiveQualification;
    if (stage) membershipFilter.stage = stage;
    if (operationStatus === "not-worked") membershipFilter.lastInteractionAt = null;
    if (operationStatus === "worked") membershipFilter.lastInteractionAt = { not: null };
    const interactionRange = dateRange(lastInteractionFrom, lastInteractionTo);
    if (interactionRange) membershipFilter.lastInteractionAt = interactionRange;
    if (Object.keys(membershipFilter).length > 0) {
      where.bases = {
        some: membershipFilter,
      };
    }
    if (city) where.city = { contains: city.trim(), mode: "insensitive" };
    if (state) where.state = { equals: state.trim(), mode: "insensitive" };
    if (segment) {
      where.segment = { contains: segment.trim(), mode: "insensitive" };
    }
    if (completeness === "missing-phone") where.phone = null;
    if (completeness === "missing-email") where.email = null;
    if (completeness === "missing-site") where.website = null;
    if (completeness === "incomplete") {
      const completenessFilter: Prisma.CompanyWhereInput = {
        OR: [
          { phone: null },
          { email: null },
          { website: null },
          { segment: null },
          { city: null },
          { state: null },
        ],
      };
      and.push(completenessFilter);
    }

    const phoneTypes = [ContactType.PHONE, ContactType.WHATSAPP];
    const usablePhone: Prisma.CompanyWhereInput = {
      OR: [
        { phone: { not: null } },
        {
          contacts: {
            some: {
              type: { in: phoneTypes },
              archivedAt: null,
              validity: { not: "INVALID" },
            },
          },
        },
      ],
    };
    const effectivePhoneStatus =
      quickView === "missing-phone" ? "missing" : phoneStatus;
    if (effectivePhoneStatus === "has" || quickView === "ready") and.push(usablePhone);
    if (effectivePhoneStatus === "missing") and.push({ NOT: usablePhone });
    if (effectivePhoneStatus === "invalid") {
      and.push({
        contacts: {
          some: {
            type: { in: phoneTypes },
            validity: "INVALID",
          },
        },
      });
    }
    if (whatsapp === "has") {
      and.push({
        contacts: {
          some: { archivedAt: null, isWhatsapp: true, validity: { not: "INVALID" } },
        },
      });
    }

    const usableEmail: Prisma.CompanyWhereInput = {
      OR: [
        { email: { not: null } },
        {
          contacts: {
            some: { type: ContactType.EMAIL, archivedAt: null, validity: { not: "INVALID" } },
          },
        },
      ],
    };
    if (emailStatus === "missing" || quickView === "missing-email") {
      and.push({ NOT: usableEmail });
    }
    const hasResponsible: Prisma.CompanyWhereInput = {
      OR: [
        { contactName: { not: null } },
        { contacts: { some: { archivedAt: null, responsibleName: { not: null } } } },
      ],
    };
    if (responsible === "has") and.push(hasResponsible);
    if (responsible === "missing" || quickView === "missing-responsible") {
      and.push({ NOT: hasResponsible });
    }
    if (quickView === "pending-returns") {
      and.push({ followUps: { some: { status: "PENDING" } } });
    }
    if (operationStatus === "pending-return") {
      and.push({ followUps: { some: { status: "PENDING" } } });
    }

    const updateRange = dateRange(updatedFrom, updatedTo);
    if (updateRange) where.updatedAt = updateRange;
    if (and.length) where.AND = and;

    return where;
  }

  static async findPage({
    query,
    baseId,
    city,
    state,
    segment,
    completeness,
    qualification,
    stage,
    phoneStatus,
    whatsapp,
    emailStatus,
    responsible,
    operationStatus,
    lastInteractionFrom,
    lastInteractionTo,
    updatedFrom,
    updatedTo,
    quickView,
    page = 1,
    pageSize = 25,
  }: FindCompaniesInput = {}) {
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(10, Math.floor(pageSize)));
    const where = this.buildWhere({
      query,
      baseId,
      city,
      state,
      segment,
      completeness,
      qualification,
      stage,
      phoneStatus,
      whatsapp,
      emailStatus,
      responsible,
      operationStatus,
      lastInteractionFrom,
      lastInteractionTo,
      updatedFrom,
      updatedTo,
      quickView,
    });
    const total = await prisma.company.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const actualPage = Math.min(safePage, totalPages);
    const companies = await prisma.company.findMany({
      where,
      include: {
        bases: {
          include: {
            base: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
          orderBy: {
            base: {
              name: "asc",
            },
          },
        },
        contacts: {
          where: { archivedAt: null },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 3,
        },
      },
      orderBy: [{ tradeName: { sort: "asc", nulls: "last" } }, { corporateName: "asc" }, { id: "asc" }],
      skip: (actualPage - 1) * safePageSize,
      take: safePageSize,
    });

    return {
      companies,
      total,
      page: actualPage,
      pageSize: safePageSize,
      totalPages,
    };
  }

  static async countQuickViews(baseId?: string) {
    const views: CompanyQuickView[] = [
      "all",
      "contact-update",
      "missing-phone",
      "missing-email",
      "missing-responsible",
      "ready",
      "pending-returns",
    ];
    const counts = await Promise.all(
      views.map((quickView) =>
        prisma.company.count({ where: this.buildWhere({ baseId, quickView }) })
      )
    );
    return Object.fromEntries(views.map((view, index) => [view, counts[index]])) as Record<CompanyQuickView, number>;
  }

  static async countQuickView(quickView: CompanyQuickView, baseId?: string) {
    return prisma.company.count({
      where: this.buildWhere({ baseId, quickView }),
    });
  }

  static async findAll(input: FindCompaniesInput = {}) {
    const result = await this.findPage({ ...input, page: 1, pageSize: 100 });
    return result.companies;
  }

  static async findById(id: string) {
    return prisma.company.findUnique({
      where: { id },
      include: {
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        bases: {
          include: {
            base: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
          orderBy: {
            base: {
              name: "asc",
            },
          },
        },
        interactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            base: {
              select: {
                id: true,
                name: true,
              },
            },
            corrections: {
              include: {
                user: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        },
        dataChanges: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        },
      },
    });
  }
}
