import { Prisma } from "@prisma/client";
import "server-only";

import { prisma } from "@/lib/prisma";
import { normalizeCnpj, normalizeText } from "@/features/import/lib/import-utils";

type FindCompaniesInput = {
  query?: string;
  baseId?: string;
  page?: number;
  pageSize?: number;
};

export class CompanyService {
  static buildWhere({ query, baseId }: FindCompaniesInput = {}) {
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

    return where;
  }

  static async findPage({
    query,
    baseId,
    page = 1,
    pageSize = 25,
  }: FindCompaniesInput = {}) {
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(10, Math.floor(pageSize)));
    const where = this.buildWhere({ query, baseId });
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
      },
    });
  }
}
