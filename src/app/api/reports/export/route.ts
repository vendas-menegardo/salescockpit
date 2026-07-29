import {
  CommercialStage,
  InteractionChannel,
  InteractionResult,
} from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { csvRow, safeExportFileName } from "@/features/analytics/lib/csv";
import {
  defaultDateRange,
  type AnalyticsFilters,
} from "@/features/analytics/lib/report-filters";
import { AnalyticsService } from "@/features/analytics/services/analytics-service";
import { isAdminRole } from "@/features/auth/lib/access-control";
import { formatCnpj } from "@/features/import/lib/import-utils";
import {
  COMMERCIAL_STAGE_LABELS,
  INTERACTION_RESULT_LABELS,
} from "@/features/operation/constants";
import { auth } from "@/lib/auth";

const PAGE_SIZE = 500;

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "empresas"
    ? "empresas"
    : "operacao";
  const filters = parseFilters(url.searchParams);
  const permittedUserId = isAdminRole(session.user.role)
    ? undefined
    : session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode("\uFEFF"));
        if (type === "operacao") {
          controller.enqueue(
            encoder.encode(
              csvRow([
                "Data",
                "CNPJ",
                "Empresa",
                "Base",
                "Usuário",
                "Canal",
                "Resultado",
                "Etapa anterior",
                "Próxima etapa",
                "Telefone/contato",
                "Observação",
                "Duração (segundos)",
              ])
            )
          );
          await streamInteractions(controller, encoder, filters, permittedUserId);
        } else {
          controller.enqueue(
            encoder.encode(
              csvRow([
                "CNPJ",
                "Razão social",
                "Nome fantasia",
                "Segmento",
                "Cidade",
                "UF",
                "Telefone",
                "E-mail",
                "Site",
                "Base",
                "Etapa",
                "Responsável",
                "Última interação",
                "Próxima ação",
              ])
            )
          );
          await streamCompanies(controller, encoder, filters, permittedUserId);
        }
        controller.close();
      } catch {
        controller.error(new Error("REPORT_EXPORT_FAILED"));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeExportFileName(
        type,
        filters.from,
        filters.to
      )}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function streamInteractions(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  filters: AnalyticsFilters,
  permittedUserId?: string
) {
  let page = 1;
  while (true) {
    const result = await AnalyticsService.getInteractionPage({
      filters,
      permittedUserId,
      page,
      pageSize: PAGE_SIZE,
    });
    for (const row of result.rows) {
      controller.enqueue(
        encoder.encode(
          csvRow([
            row.createdAt,
            formatCnpj(row.company.cnpj),
            row.company.corporateName,
            row.base.name,
            row.user.name,
            channelLabel(row.channel),
            row.result ? INTERACTION_RESULT_LABELS[row.result] : "Em andamento",
            COMMERCIAL_STAGE_LABELS[row.previousStage],
            COMMERCIAL_STAGE_LABELS[row.nextStage],
            row.contactUsed,
            row.notes,
            row.durationSeconds,
          ])
        )
      );
    }
    if (page >= result.totalPages) break;
    page += 1;
  }
}

async function streamCompanies(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  filters: AnalyticsFilters,
  permittedUserId?: string
) {
  let page = 1;
  while (true) {
    const result = await AnalyticsService.getCompanyPage({
      filters,
      permittedUserId,
      page,
      pageSize: PAGE_SIZE,
    });
    for (const company of result.rows) {
      const membership = company.bases[0];
      controller.enqueue(
        encoder.encode(
          csvRow([
            formatCnpj(company.cnpj),
            company.corporateName,
            company.tradeName,
            company.segment,
            company.city,
            company.state,
            company.phone,
            company.email,
            company.website,
            membership?.base.name,
            membership
              ? COMMERCIAL_STAGE_LABELS[membership.stage]
              : "",
            membership?.assignedUser?.name,
            company.interactions[0]?.createdAt,
            company.followUps[0]?.dueAt,
          ])
        )
      );
    }
    if (page >= result.totalPages) break;
    page += 1;
  }
}

function parseFilters(params: URLSearchParams): AnalyticsFilters {
  const defaults = defaultDateRange(30);
  const stage = params.get("stage");
  const result = params.get("result");
  const channel = params.get("channel");
  const followUpStatus = params.get("followUpStatus");
  const completeness = params.get("completeness");
  return {
    from: params.get("from") || defaults.from,
    to: params.get("to") || defaults.to,
    userId: params.get("userId") || undefined,
    baseId: params.get("baseId") || undefined,
    city: params.get("city") || undefined,
    state: params.get("state") || undefined,
    segment: params.get("segment") || undefined,
    query: params.get("query") || undefined,
    stage: Object.values(CommercialStage).includes(stage as CommercialStage)
      ? (stage as CommercialStage)
      : undefined,
    result: Object.values(InteractionResult).includes(
      result as InteractionResult
    )
      ? (result as InteractionResult)
      : undefined,
    channel: Object.values(InteractionChannel).includes(
      channel as InteractionChannel
    )
      ? (channel as InteractionChannel)
      : undefined,
    followUpStatus: ["PENDING", "COMPLETED", "CANCELED"].includes(
      followUpStatus || ""
    )
      ? (followUpStatus as AnalyticsFilters["followUpStatus"])
      : undefined,
    completeness: ["with-phone", "with-email", "with-site", "incomplete"].includes(
      completeness || ""
    )
      ? (completeness as AnalyticsFilters["completeness"])
      : undefined,
  };
}

function channelLabel(channel: InteractionChannel) {
  return {
    CALL: "Ligação",
    WHATSAPP: "WhatsApp",
    EMAIL: "E-mail",
    INSTAGRAM: "Instagram",
    OTHER: "Outro",
  }[channel];
}
