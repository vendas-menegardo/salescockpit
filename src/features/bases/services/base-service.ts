import { prisma } from "@/lib/prisma";
import type { CreateBaseInput } from "../validations/base-schema";

export class BaseService {
  static async create(data: CreateBaseInput) {
    return prisma.base.create({
      data,
    });
  }

  static async update(id: string, data: CreateBaseInput) {
    return prisma.base.update({
      where: {
        id,
      },
      data,
    });
  }

  static async findAll() {
    return prisma.base.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static async findById(id: string) {
    return prisma.base.findUnique({
      where: {
        id,
      },
    });
  }

  static async findByIdWithCompanies(id: string) {
    const [base, companies] = await Promise.all([
      prisma.base.findUnique({
        where: {
          id,
        },
      }),
      prisma.baseCompany.findMany({
        where: {
          baseId: id,
        },
        include: {
          company: true,
        },
        orderBy: {
          company: {
            corporateName: "asc",
          },
        },
      }),
    ]);

    if (!base) {
      return null;
    }

    return {
      ...base,
      companies,
    };
  }

  static async findActive() {
    return prisma.base.findFirst({
      where: {
        isActive: true,
      },
    });
  }

  static async activate(id: string) {
    await prisma.$transaction([
      prisma.base.updateMany({
        data: {
          isActive: false,
        },
      }),

      prisma.base.update({
        where: {
          id,
        },
        data: {
          isActive: true,
        },
      }),
    ]);
  }

  static async delete(id: string) {
    return prisma.base.delete({
      where: {
        id,
      },
    });
  }
}
