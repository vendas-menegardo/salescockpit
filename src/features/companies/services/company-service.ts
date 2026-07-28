import { Prisma } from "@prisma/client";
import "server-only";

import { prisma } from "@/lib/prisma";
import { normalizeCnpj, normalizeText } from "@/features/import/lib/import-utils";

type FindCompaniesInput = {
  query?: string;
  baseId?: string;
};

export class CompanyService {
  static async findAll({ query, baseId }: FindCompaniesInput = {}) {
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

    return prisma.company.findMany({
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
      orderBy: {
        corporateName: "asc",
      },
      take: 100,
    });
  }
}
