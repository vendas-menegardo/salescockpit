import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  getCompanyDisplayName,
  getCompanySecondaryName,
} from "../src/features/companies/lib/company-display-name.ts";
import {
  companyListUrl,
  operationReturnUrl,
} from "../src/features/companies/lib/company-search-params.ts";
import { quickCompanyProfileSchema } from "../src/features/companies/validations/company-profile-schema.ts";

test("nome fantasia é principal e razão social fica secundária", () => {
  const company = { tradeName: "Vitória Social", corporateName: "Vitória Social Associação" };
  assert.equal(getCompanyDisplayName(company), "Vitória Social");
  assert.equal(getCompanySecondaryName(company), "Vitória Social Associação");
});

test("razão social é fallback quando nome fantasia não existe", () => {
  const company = { tradeName: " ", corporateName: "Associação Vitória" };
  assert.equal(getCompanyDisplayName(company), "Associação Vitória");
  assert.equal(getCompanySecondaryName(company), null);
});

test("URL preserva busca, filtros, paginação e dossiê", () => {
  const url = companyListUrl({
    query: "associação",
    baseId: "base-1",
    qualification: "ATUALIZAR_CONTATO",
    page: "3",
    companyId: "company-1",
  });
  assert.match(url, /query=associa/);
  assert.match(url, /baseId=base-1/);
  assert.match(url, /qualification=ATUALIZAR_CONTATO/);
  assert.match(url, /page=3/);
  assert.match(url, /companyId=company-1/);
  assert.doesNotMatch(operationReturnUrl({ ...Object.fromEntries(new URL(url, "http://local").searchParams), companyId: "company-1" }), /companyId/);
});

test("edição rápida valida razão social e nome fantasia separadamente", () => {
  const result = quickCompanyProfileSchema.safeParse({
    companyId: "company-1",
    corporateName: "Razão Social Preservada",
    tradeName: "Nome Fantasia Novo",
    contactName: "Responsável",
    notes: "Atualização manual",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.corporateName, "Razão Social Preservada");
    assert.equal(result.data.tradeName, "Nome Fantasia Novo");
  }
});

test("busca unificada cobre cadastro, contatos e responsável sem N+1", () => {
  const service = fs.readFileSync("src/features/companies/services/company-service.ts", "utf8");
  for (const field of ["corporateName", "tradeName", "cnpj", "phone", "email", "contactName", "responsibleName"]) {
    assert.match(service, new RegExp(field));
  }
  assert.match(service, /skip: \(actualPage - 1\) \* safePageSize/);
  assert.match(service, /take: safePageSize/);
  assert.doesNotMatch(service, /for \([\s\S]{0,100}prisma\./);
});

test("Central oferece filtros operacionais e visualização Atualizar contato", () => {
  const filters = fs.readFileSync("src/features/companies/components/company-central-filters.tsx", "utf8");
  for (const filter of ["contact-update", "phoneStatus", "whatsapp", "emailStatus", "responsible", "lastInteractionFrom", "updatedFrom"]) {
    assert.match(filters, new RegExp(filter));
  }
  assert.match(filters, /setTimeout[\s\S]*350/);
  assert.match(filters, /focus-visible:ring/);
  assert.match(filters, /motion-reduce/);
  assert.match(filters, /globalContactUpdateCount/);
  assert.match(filters, /Ver todas as bases/);
  assert.match(filters, /params\.delete\("baseId"\)/);
});

test("contagem global de Atualizar contato não depende do filtro de base", () => {
  const page = fs.readFileSync("src/app/(dashboard)/empresas/page.tsx", "utf8");
  const service = fs.readFileSync("src/features/companies/services/company-service.ts", "utf8");
  assert.match(page, /CompanyService\.countQuickView\("contact-update"\)/);
  assert.match(service, /static async countQuickView\(quickView: CompanyQuickView, baseId\?: string\)/);
  assert.match(service, /this\.buildWhere\(\{ baseId, quickView \}\)/);
});

test("rotas antigas redirecionam preservando parâmetros e Pesquisa sai do menu", () => {
  const pesquisa = fs.readFileSync("src/app/(dashboard)/pesquisa/page.tsx", "utf8");
  const busca = fs.readFileSync("src/app/(dashboard)/busca/page.tsx", "utf8");
  const sidebar = fs.readFileSync("src/components/layout/app-sidebar.tsx", "utf8");
  assert.match(pesquisa, /redirect\(`\/empresas/);
  assert.match(busca, /redirect\(`\/empresas/);
  assert.doesNotMatch(sidebar, /name: "Pesquisa"/);
});

test("dossiê fecha sem perder contexto e mantém acesso à Operação", () => {
  const sheet = fs.readFileSync("src/features/companies/components/company-dossier-sheet.tsx", "utf8");
  const page = fs.readFileSync("src/app/(dashboard)/empresas/page.tsx", "utf8");
  assert.match(sheet, /params\.delete\("companyId"\)/);
  assert.match(sheet, /scroll: false/);
  assert.match(page, /Abrir na Operação/);
  assert.match(page, /operationReturnUrl/);
});

test("contatos continuam deduplicados e auditados no serviço existente", () => {
  const service = fs.readFileSync("src/features/companies/services/company-contact-service.ts", "utf8");
  assert.match(service, /DUPLICATE_CONTACT/);
  assert.match(service, /companyContactEvent\.create/);
  assert.match(service, /canonicalContactValue/);
});

test("Operação usa a mesma regra de nome e edita os dois campos", () => {
  const workspace = fs.readFileSync("src/features/operation/components/operation-workspace.tsx", "utf8");
  const panel = fs.readFileSync("src/features/operation/components/operation-company-panel.tsx", "utf8");
  assert.match(workspace, /getCompanyDisplayName\(current\.company\)/);
  assert.match(workspace, /getCompanySecondaryName\(current\.company\)/);
  assert.match(panel, /name="corporateName"/);
  assert.match(panel, /name="tradeName"/);
  assert.doesNotMatch(panel, /corporateName[^\n]+disabled/);
});

test("botões mantêm foco, loading e movimento reduzido", () => {
  const buttons = fs.readFileSync("src/components/ui/button.tsx", "utf8");
  const form = fs.readFileSync("src/features/companies/components/edit-company-profile-form.tsx", "utf8");
  const css = fs.readFileSync("src/app/globals.css", "utf8");
  assert.match(buttons, /focus-visible:ring/);
  assert.match(buttons, /disabled:pointer-events-none/);
  assert.match(form, /disabled=\{pending\}/);
  assert.match(form, /toast\.success/);
  assert.match(css, /prefers-reduced-motion/);
});
