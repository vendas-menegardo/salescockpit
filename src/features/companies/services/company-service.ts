import { Prisma } from "@prisma/client";
import "server-only";

import { prisma } from "@/lib/prisma";
import { normalizeCnpj, normalizeText } from "@/features/import/lib/import-utils";

type FindCompaniesInput = {
  query?: string;
  baseId?: string;
  city?: string;
  state?: string;
  segment?: string;
  completeness?: "all" | "incomplete" | "missing-phone" | "missing-email" | "missing-site";
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
  }: FindCompaniesInput = {}) {
    const normalizedQuery = normalizeText(query);
    const cnpjQuery = normalizeCnpj(query);
    const where: Prisma.CompanyWhereInput = {};

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

    if (baseId) {
      where.bases = {
        some: {
          baseId,
        },
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
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        completenessFilter,
      ];
    }

    return where;
  }

  static async findPage({
    query,
    baseId,
    city,
    state,
    segment,
    completeness,
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
          where: { validity: { not: "INVALID" } },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 3,
        },
      },
      orderBy: [{ corporateName: "asc" }, { id: "asc" }],
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
