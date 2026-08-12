import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const service = fs.readFileSync("src/features/enrichment/services/enrichment-service.ts", "utf8");
const actions = fs.readFileSync("src/features/enrichment/actions/enrichment-actions.ts", "utf8");
const panel = fs.readFileSync("src/features/enrichment/components/enrichment-review-panel.tsx", "utf8");
const page = fs.readFileSync("src/app/(dashboard)/enriquecimento/page.tsx", "utf8");

test("fila de enriquecimento é paginada e consulta contatos sem N+1", () => {
  assert.match(service, /const pageSize = 20/);
  assert.match(service, /skip: \(page - 1\) \* pageSize/);
  assert.match(service, /take: pageSize/);
  assert.match(service, /contacts: \{/);
  assert.doesNotMatch(service, /for \([\s\S]{0,120}(?:prisma|tx)\./);
});

test("candidatos são criados pendentes, com fonte e autenticação", () => {
  assert.match(actions, /await requireSession\(\)/);
  assert.match(actions, /validity: ContactValidity\.UNKNOWN/);
  assert.match(actions, /source: formData\.get\("source"\)/);
  assert.match(actions, /CompanyContactService\.create/);
  assert.doesNotMatch(actions, /validity: ContactValidity\.VALID[\s\S]{0,100}CompanyContactService\.create/);
});

test("revisão reutiliza deduplicação e auditoria do serviço central", () => {
  assert.match(actions, /CompanyContactService\.applyIntent/);
  assert.match(actions, /decision === "accept" \? "valid"/);
  assert.match(actions, /decision === "primary" \? "primary"/);
  assert.match(actions, /"invalid_other"/);
});

test("conclusão é atômica e exige contato validado", () => {
  assert.match(service, /prisma\.\$transaction/);
  assert.match(service, /validity: ContactValidity\.VALID/);
  assert.match(service, /VALID_CONTACT_REQUIRED/);
  assert.match(service, /qualification: CompanyQualification\.EM_OPERACAO/);
  assert.match(service, /baseCompanyChange\.create/);
});

test("interface preserva loading, bloqueio de envio e decisão humana", () => {
  assert.match(panel, /disabled=\{pending/);
  assert.match(panel, /Adicionar candidato/);
  assert.match(panel, /Validar/);
  assert.match(panel, /Rejeitar/);
  assert.match(panel, /validCount === 0/);
  assert.match(page, /Sem telefone/);
  assert.match(page, /Sem e-mail/);
  assert.match(page, /Sem responsável/);
});
