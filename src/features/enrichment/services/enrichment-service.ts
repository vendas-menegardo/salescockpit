import "server-only";

import { prisma } from "@/lib/prisma";
import { getEnrichmentProvider } from "../providers/enrichment-provider";

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
}
