import "server-only";

import { CompanyQualification, ContactType, ContactValidity, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getEnrichmentProvider } from "../providers/enrichment-provider";

export type EnrichmentQueueFilter = "pending" | "missing-phone" | "missing-email" | "missing-responsible";

type QueueInput = {
  baseId?: string;
  query?: string;
  filter?: EnrichmentQueueFilter;
  page?: number;
};

const queueCompanySelect = {
  id: true,
  corporateName: true,
  tradeName: true,
  cnpj: true,
  city: true,
  state: true,
  phone: true,
  email: true,
  contactName: true,
  contacts: {
    where: { archivedAt: null },
    orderBy: [{ isPrimary: "desc" as const }, { createdAt: "desc" as const }],
  },
  bases: {
    include: { base: { select: { id: true, name: true, isActive: true } } },
    orderBy: { base: { name: "asc" as const } },
  },
} satisfies Prisma.CompanySelect;

function queueWhere({ baseId, query, filter = "pending" }: QueueInput): Prisma.CompanyWhereInput {
  const membership: Prisma.BaseCompanyWhereInput = {
    qualification: CompanyQualification.ATUALIZAR_CONTATO,
    ...(baseId ? { baseId } : {}),
  };
  const and: Prisma.CompanyWhereInput[] = [{ bases: { some: membership } }];
  const value = query?.trim();
  if (value) {
    const cnpj = value.replace(/\D/g, "");
    and.push({
      OR: [
        { corporateName: { contains: value, mode: "insensitive" } },
        { tradeName: { contains: value, mode: "insensitive" } },
        ...(cnpj ? [{ cnpj: { contains: cnpj } }] : []),
      ],
    });
  }
  if (filter === "missing-phone") {
    and.push({
      NOT: {
        OR: [
          { phone: { not: null } },
          { contacts: { some: { type: { in: [ContactType.PHONE, ContactType.WHATSAPP] }, archivedAt: null, validity: { not: ContactValidity.INVALID } } } },
        ],
      },
    });
  }
  if (filter === "missing-email") {
    and.push({
      NOT: {
        OR: [
          { email: { not: null } },
          { contacts: { some: { type: ContactType.EMAIL, archivedAt: null, validity: { not: ContactValidity.INVALID } } } },
        ],
      },
    });
  }
  if (filter === "missing-responsible") {
    and.push({
      contactName: null,
      contacts: { none: { archivedAt: null, responsibleName: { not: null } } },
    });
  }
  return { AND: and };
}

export class EnrichmentService {
  static isProviderConfigured() {
    return getEnrichmentProvider()?.isConfigured() ?? false;
  }

  static getRecentJobs(userId: string, includeAllUsers: boolean) {
    return prisma.enrichmentJob.findMany({
      where: includeAllUsers ? {} : { userId },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  }

  static async getQueue(input: QueueInput = {}) {
    const pageSize = 20;
    const requestedPage = Math.max(1, Math.floor(input.page || 1));
    const where = queueWhere(input);
    const total = await prisma.company.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const companies = await prisma.company.findMany({
      where,
      select: queueCompanySelect,
      orderBy: [{ updatedAt: "asc" }, { corporateName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { companies, total, page, totalPages };
  }

  static async getOverview(baseId?: string) {
    const filters: EnrichmentQueueFilter[] = ["pending", "missing-phone", "missing-email", "missing-responsible"];
    const values = await Promise.all(filters.map((filter) => prisma.company.count({ where: queueWhere({ baseId, filter }) })));
    return Object.fromEntries(filters.map((filter, index) => [filter, values[index]])) as Record<EnrichmentQueueFilter, number>;
  }

  static getCompany(companyId: string) {
    return prisma.company.findUnique({ where: { id: companyId }, select: queueCompanySelect });
  }

  static async completeContactUpdate({ companyId, baseId, userId }: { companyId: string; baseId: string; userId: string }) {
    return prisma.$transaction(async (tx) => {
      const membership = await tx.baseCompany.findUnique({
        where: { baseId_companyId: { baseId, companyId } },
        select: { qualification: true, qualificationReason: true },
      });
      if (!membership) throw new Error("MEMBERSHIP_NOT_FOUND");
      if (membership.qualification !== CompanyQualification.ATUALIZAR_CONTATO) throw new Error("ALREADY_COMPLETED");

      const validatedContacts = await tx.companyContact.count({
        where: {
          companyId,
          archivedAt: null,
          validity: ContactValidity.VALID,
          type: { in: [ContactType.PHONE, ContactType.WHATSAPP, ContactType.EMAIL] },
        },
      });
      if (validatedContacts === 0) throw new Error("VALID_CONTACT_REQUIRED");

      await tx.baseCompany.update({
        where: { baseId_companyId: { baseId, companyId } },
        data: { qualification: CompanyQualification.EM_OPERACAO, qualificationReason: "Contato validado na central de enriquecimento" },
      });
      await tx.baseCompanyChange.create({
        data: {
          baseId,
          companyId,
          userId,
          type: "QUALIFICATION_CHANGED",
          reason: "Enriquecimento de contato concluído",
          previousState: { qualification: membership.qualification, qualificationReason: membership.qualificationReason },
          nextState: { qualification: CompanyQualification.EM_OPERACAO, qualificationReason: "Contato validado na central de enriquecimento" },
        },
      });
    });
  }
}
