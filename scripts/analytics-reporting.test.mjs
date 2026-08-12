import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildInteractionWhere,
  buildMembershipWhere,
  parseDateRange,
} from "../src/features/analytics/lib/report-filters.ts";
import {
  csvCell,
  csvRow,
  safeExportFileName,
} from "../src/features/analytics/lib/csv.ts";

test("período usa dias completos no fuso de São Paulo", () => {
  const range = parseDateRange("2026-07-28", "2026-07-29");
  assert.equal(range.start.toISOString(), "2026-07-28T03:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-07-30T03:00:00.000Z");
});

test("escopo obrigatório do usuário substitui filtro solicitado", () => {
  const where = buildInteractionWhere(
    {
      from: "2026-07-28",
      to: "2026-07-29",
      userId: "outro-usuario",
      baseId: "base-1",
    },
    "usuario-permitido"
  );
  assert.equal(where.userId, "usuario-permitido");
  assert.equal(where.baseId, "base-1");
});

test("filtros operacionais e de empresa preservam base e etapa", () => {
  const where = buildMembershipWhere({
    from: "2026-07-28",
    to: "2026-07-29",
    baseId: "base-1",
    stage: "QUALIFICADA",
    city: "Vitória",
  });
  assert.equal(where.baseId, "base-1");
  assert.equal(where.stage, "QUALIFICADA");
  assert.deepEqual(where.company.city, {
    equals: "Vitória",
    mode: "insensitive",
  });
});

test("CSV preserva CNPJ como texto, acentos e separadores", () => {
  const line = csvRow([
    "01.234.567/0001-89",
    'Associação "Vitória"; ES',
  ]);
  assert.match(line, /^"01\.234\.567\/0001-89";/);
  assert.match(line, /Associação ""Vitória""; ES/);
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell("=2+2"), `"'=2+2"`);
});

test("nome de exportação não aceita conteúdo fora de data ISO", () => {
  assert.equal(
    safeExportFileName("operacao", "../../segredo", "2026-07-29"),
    "salescockpit-operacao-periodo-a-2026-07-29.csv"
  );
});

test("pesquisa incompleta é executada no banco", () => {
  const source = fs.readFileSync(
    "src/features/companies/services/company-service.ts",
    "utf8"
  );
  assert.match(source, /completeness === "incomplete"/);
  assert.match(source, /where\.city = \{ contains:/);
  assert.match(source, /prisma\.company\.findMany/);
  assert.match(source, /skip: \(actualPage - 1\) \* safePageSize/);
  assert.match(source, /take: safePageSize/);
});

test("migration de métricas é aditiva e transacional", () => {
  const sql = fs.readFileSync(
    "prisma/migrations/20260729143000_add_analytics_enrichment/migration.sql",
    "utf8"
  );
  assert.match(sql, /^BEGIN;/);
  assert.match(sql, /CREATE TABLE "CompanyDataChange"/);
  assert.match(sql, /CREATE TABLE "EnrichmentJob"/);
  assert.match(sql, /CREATE TABLE "EnrichmentJobItem"/);
  assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN)\b/i);
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i);
  assert.match(sql, /COMMIT;\s*$/);
});

test("Dashboard e Relatórios usam a mesma fonte de métricas", () => {
  const dashboard = fs.readFileSync(
    "src/app/(dashboard)/page.tsx",
    "utf8"
  );
  const reports = fs.readFileSync(
    "src/app/(dashboard)/relatorios/page.tsx",
    "utf8"
  );
  assert.match(dashboard, /AnalyticsService\.getMetrics/);
  assert.match(reports, /AnalyticsService\.getMetrics/);
});

test("métricas reconhecem os resultados realmente oferecidos na Operação", () => {
  const analytics = fs.readFileSync(
    "src/features/analytics/services/analytics-service.ts",
    "utf8"
  );
  assert.match(analytics, /ANSWERED_RESULTS = \[[\s\S]*InteractionResult\.ATENDEU/);
  assert.match(analytics, /INVALID_NUMBER_RESULTS = \[/);
  assert.match(analytics, /InteractionResult\.NUMERO_ERRADO/);
  assert.match(analytics, /InteractionResult\.NUMERO_INEXISTENTE/);
  assert.match(analytics, /result: \{ in: INVALID_NUMBER_RESULTS \}/);
});

test("exportação exige sessão e aplica escopo de perfil", () => {
  const source = fs.readFileSync(
    "src/app/api/reports/export/route.ts",
    "utf8"
  );
  assert.match(source, /auth\.api\.getSession/);
  assert.match(source, /status: 401/);
  assert.match(source, /isAdminRole\(session\.user\.role\)/);
  assert.match(source, /permittedUserId/);
  assert.match(source, /while \(true\)/);
  assert.match(source, /page \+= 1/);
});

test("provedor ausente não cria enriquecimento fictício", () => {
  const source = fs.readFileSync(
    "src/features/enrichment/providers/enrichment-provider.ts",
    "utf8"
  );
  assert.match(source, /getEnrichmentProvider\(\): EnrichmentProvider \| null/);
  assert.match(source, /return null/);
});

test("edição do dossiê grava cadastro e auditoria atomicamente", () => {
  const source = fs.readFileSync(
    "src/features/companies/actions/company-profile-actions.ts",
    "utf8"
  );
  assert.match(source, /prisma\.\$transaction\(\[/);
  assert.match(source, /prisma\.company\.update/);
  assert.match(source, /prisma\.companyDataChange\.create/);
  assert.match(source, /completenessBefore: before/);
  assert.match(source, /completenessAfter: after/);
});

test("Dashboard atualiza em intervalo moderado apenas quando visível", () => {
  const source = fs.readFileSync(
    "src/features/analytics/components/dashboard-auto-refresh.tsx",
    "utf8"
  );
  assert.match(source, /60_000/);
  assert.match(source, /document\.visibilityState === "visible"/);
  assert.match(source, /router\.refresh\(\)/);
});

test("Dashboard usa a altura disponível sem rolagem do documento", () => {
  const source = fs.readFileSync("src/app/(dashboard)/page.tsx", "utf8");

  assert.match(source, /lg:h-full lg:overflow-hidden/);
  assert.match(source, /grid min-h-0 flex-1/);
  assert.match(source, /xl:grid-rows-\[auto_minmax\(0,1fr\)\]/);
  assert.match(source, /xl:overflow-y-auto/);
});
