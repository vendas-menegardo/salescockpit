import {
  CommercialStage,
  FollowUpStatus,
  type Prisma,
} from "@prisma/client";

import type { OperationView } from "../constants";

const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
const BUSINESS_UTC_OFFSET = "-03:00";

export function getBusinessDayRange(reference = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const start = new Date(
    `${values.year}-${values.month}-${values.day}T00:00:00${BUSINESS_UTC_OFFSET}`
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function buildQueueWhere({
  baseId,
  userId,
  view,
  now = new Date(),
}: {
  baseId: string;
  userId: string;
  view: OperationView;
  now?: Date;
}): Prisma.BaseCompanyWhereInput {
  const common: Prisma.BaseCompanyWhereInput = {
    baseId,
    OR: [{ assignedUserId: null }, { assignedUserId: userId }],
  };
  const { start, end } = getBusinessDayRange(now);

  switch (view) {
    case "attempting":
      return { ...common, stage: CommercialStage.EM_TENTATIVA };
    case "returns-today":
      return {
        ...common,
        company: {
          followUps: {
            some: {
              baseId,
              userId,
              status: FollowUpStatus.PENDING,
              dueAt: { gte: start, lt: end },
            },
          },
        },
      };
    case "overdue":
      return {
        ...common,
        company: {
          followUps: {
            some: {
              baseId,
              userId,
              status: FollowUpStatus.PENDING,
              dueAt: { lt: start },
            },
          },
        },
      };
    case "qualified":
      return { ...common, stage: CommercialStage.QUALIFICADA };
    case "meetings":
      return {
        ...common,
        stage: {
          in: [
            CommercialStage.REUNIAO_AGENDADA,
            CommercialStage.REUNIAO_REALIZADA,
          ],
        },
      };
    case "frozen":
      return { ...common, stage: CommercialStage.CONGELADA };
    case "not-worked":
    default:
      return { ...common, stage: CommercialStage.NOVA };
  }
}
