import type {
  CommercialStage,
  InteractionChannel,
  InteractionResult,
  Prisma,
} from "@prisma/client";

const BUSINESS_UTC_OFFSET = "-03:00";

export type AnalyticsFilters = {
  from: string;
  to: string;
  userId?: string;
  baseId?: string;
  city?: string;
  state?: string;
  segment?: string;
  stage?: CommercialStage;
  result?: InteractionResult;
  channel?: InteractionChannel;
  followUpStatus?: "PENDING" | "COMPLETED" | "CANCELED";
  completeness?: "with-phone" | "with-email" | "with-site" | "incomplete";
  query?: string;
};

export function formatBusinessDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function defaultDateRange(days = 0, now = new Date()) {
  const to = formatBusinessDate(now);
  const from = formatBusinessDate(
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  );
  return { from, to };
}

export function parseDateRange(from: string, to: string) {
  const safeFrom = /^\d{4}-\d{2}-\d{2}$/.test(from)
    ? from
    : defaultDateRange(30).from;
  const safeTo = /^\d{4}-\d{2}-\d{2}$/.test(to)
    ? to
    : defaultDateRange(30).to;
  const start = new Date(`${safeFrom}T00:00:00${BUSINESS_UTC_OFFSET}`);
  const inclusiveEnd = new Date(`${safeTo}T00:00:00${BUSINESS_UTC_OFFSET}`);
  const end = new Date(inclusiveEnd.getTime() + 24 * 60 * 60 * 1000);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start >= end
  ) {
    const fallback = defaultDateRange(30);
    return {
      ...fallback,
      start: new Date(`${fallback.from}T00:00:00${BUSINESS_UTC_OFFSET}`),
      end: new Date(
        new Date(`${fallback.to}T00:00:00${BUSINESS_UTC_OFFSET}`).getTime() +
          24 * 60 * 60 * 1000
      ),
    };
  }

  return { from: safeFrom, to: safeTo, start, end };
}

export function buildInteractionWhere(
  filters: AnalyticsFilters,
  permittedUserId?: string
): Prisma.SalesInteractionWhereInput {
  const range = parseDateRange(filters.from, filters.to);
  const userId = permittedUserId ?? filters.userId;
  const companyFilters: Prisma.CompanyWhereInput = {};

  if (filters.city) {
    companyFilters.city = { equals: filters.city, mode: "insensitive" };
  }
  if (filters.state) {
    companyFilters.state = { equals: filters.state, mode: "insensitive" };
  }
  if (filters.segment) {
    companyFilters.segment = {
      contains: filters.segment,
      mode: "insensitive",
    };
  }
  if (filters.query) {
    const digits = filters.query.replace(/\D/g, "");
    companyFilters.OR = [
      {
        corporateName: {
          contains: filters.query.trim(),
          mode: "insensitive",
        },
      },
      {
        tradeName: {
          contains: filters.query.trim(),
          mode: "insensitive",
        },
      },
      ...(digits ? [{ cnpj: { contains: digits } }] : []),
    ];
  }

  return {
    createdAt: { gte: range.start, lt: range.end },
    ...(userId ? { userId } : {}),
    ...(filters.baseId ? { baseId: filters.baseId } : {}),
    ...(filters.result ? { result: filters.result } : {}),
    ...(filters.stage ? { nextStage: filters.stage } : {}),
    ...(filters.channel ? { channel: filters.channel } : {}),
    ...(filters.followUpStatus
      ? { followUps: { some: { status: filters.followUpStatus } } }
      : {}),
    ...(Object.keys(companyFilters).length ? { company: companyFilters } : {}),
  };
}

export function buildMembershipWhere(
  filters: AnalyticsFilters,
  permittedUserId?: string
): Prisma.BaseCompanyWhereInput {
  const userId = permittedUserId ?? filters.userId;
  return {
    ...(filters.baseId ? { baseId: filters.baseId } : {}),
    ...(userId ? { assignedUserId: userId } : {}),
    ...(filters.stage ? { stage: filters.stage } : {}),
    company: {
      ...(filters.city
        ? { city: { equals: filters.city, mode: "insensitive" } }
        : {}),
      ...(filters.state
        ? { state: { equals: filters.state, mode: "insensitive" } }
        : {}),
      ...(filters.segment
        ? {
            segment: {
              contains: filters.segment,
              mode: "insensitive",
            },
          }
        : {}),
      ...(filters.query
        ? {
            OR: [
              {
                corporateName: {
                  contains: filters.query.trim(),
                  mode: "insensitive",
                },
              },
              {
                tradeName: {
                  contains: filters.query.trim(),
                  mode: "insensitive",
                },
              },
              ...(filters.query.replace(/\D/g, "")
                ? [{ cnpj: { contains: filters.query.replace(/\D/g, "") } }]
                : []),
            ],
          }
        : {}),
    },
  };
}
