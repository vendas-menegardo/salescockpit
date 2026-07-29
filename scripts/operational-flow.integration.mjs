import assert from "node:assert/strict";
import { createHash, randomInt, randomUUID } from "node:crypto";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { BaseService } from "../src/features/bases/services/base-service.ts";
import { CompanyService } from "../src/features/companies/services/company-service.ts";
import { eligibleRowsForImport } from "../src/features/import/lib/import-batching.ts";
import {
  ImportService,
  ImportValidationError,
} from "../src/features/import/services/import-service.ts";

const ISOLATED_DATABASE_HOST =
  "ep-soft-sky-ac9ou8si-pooler.sa-east-1.aws.neon.tech";

function assertIsolatedDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  assert.ok(databaseUrl, "DATABASE_URL não está configurada para o teste.");
  assert.equal(
    new URL(databaseUrl).hostname.toLowerCase(),
    ISOLATED_DATABASE_HOST,
    "Teste operacional bloqueado fora da branch Neon isolada autorizada."
  );
}

function createCnpj(root) {
  const calculateDigit = (digits, weights) => {
    const sum = [...digits].reduce(
      (total, digit, index) => total + Number(digit) * weights[index],
      0
    );
    const remainder = sum % 11;

    return remainder < 2 ? 0 : 11 - remainder;
  };
  const firstDigit = calculateDigit(
    root,
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );
  const secondDigit = calculateDigit(
    `${root}${firstDigit}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );

  return `${root}${firstDigit}${secondDigit}`;
}

function createSyntheticCnpjs() {
  const seed = String(randomInt(10_000_000, 99_999_999));

  return [
    createCnpj(`${seed}0001`),
    createCnpj(`${seed}0002`),
    createCnpj(`${seed}0003`),
  ];
}

function summaryFromAnalysis(analysis) {
  return {
    totalRows: analysis.summary.totalRows,
    invalidRows: analysis.summary.invalidRows,
    duplicateRows: analysis.summary.duplicateRows,
    emptyRowsIgnored: analysis.summary.emptyRowsIgnored,
    eligibleRows: analysis.summary.eligibleRows,
  };
}

async function runImport({ baseId, csvText, fileName }) {
  const analysis = await ImportService.analyze({
    baseId,
    csvText,
    fileName,
  });
  const context = {
    jobId: randomUUID(),
    baseId,
    fileHash: createHash("sha256").update(csvText).digest("hex"),
  };

  await ImportService.startJob({
    ...context,
    fileName,
    summary: summaryFromAnalysis(analysis),
  });
  await ImportService.stageJobRows(
    context,
    eligibleRowsForImport(analysis.rows)
  );
  await ImportService.finalizeJob(context);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await ImportService.processJobBatch(context);

    if (response.result) {
      return {
        analysis,
        result: response.result,
      };
    }
  }

  throw new Error("A importação sintética não foi concluída.");
}

test("percurso operacional de base e importação", async (t) => {
  assertIsolatedDatabase();

  const prisma = new PrismaClient();
  const cnpjs = createSyntheticCnpjs();
  const previousActiveBase = await prisma.base.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  let baseId;

  try {
    await t.test("cria, ativa e consulta uma base", async () => {
      const base = await BaseService.create({
        name: `Teste operacional ${randomUUID()}`,
        description: "Fixture sintética descartável",
      });
      baseId = base.id;

      await BaseService.activate(base.id);

      assert.equal((await BaseService.findActive())?.id, base.id);
      assert.equal((await BaseService.findById(base.id))?.id, base.id);
    });

    await t.test("recusa importação sem baseId antes de gravar", async () => {
      const companiesBefore = await prisma.company.count();

      await assert.rejects(
        ImportService.analyze({
          baseId: "",
          fileName: "sem-base.csv",
          csvText: "CNPJ,Razão Social\n12.345.678/0001-95,Empresa",
        }),
        (error) =>
          error instanceof ImportValidationError &&
          error.message === "Selecione uma base de destino."
      );

      assert.equal(await prisma.company.count(), companiesBefore);
    });

    await t.test("recusa uma base inexistente antes de gravar", async () => {
      const companiesBefore = await prisma.company.count();

      await assert.rejects(
        ImportService.analyze({
          baseId: `inexistente-${randomUUID()}`,
          fileName: "base-inexistente.csv",
          csvText: "CNPJ,Razão Social\n12.345.678/0001-95,Empresa",
        }),
        /A base de destino não foi encontrada/
      );

      assert.equal(await prisma.company.count(), companiesBefore);
    });

    const csvText = [
      "CNPJ,Razão Social,Nome Fantasia,Cidade,UF",
      `${cnpjs[0]},Empresa Sintética A,Teste A,Vitória,ES`,
      `${cnpjs[1]},Empresa Sintética B,Teste B,Vila Velha,ES`,
      `${cnpjs[0]},Empresa Sintética Duplicada,Duplicada,Vitória,ES`,
    ].join("\n");

    await t.test(
      "importa, vincula e lista empresas da base correta",
      async () => {
        assert.ok(baseId);

        const { analysis, result } = await runImport({
          baseId,
          csvText,
          fileName: "amostra-sintetica.csv",
        });

        assert.equal(analysis.summary.totalRows, 3);
        assert.equal(analysis.summary.eligibleRows, 2);
        assert.equal(analysis.summary.duplicateRows, 1);
        assert.equal(result.companiesCreated, 2);
        assert.equal(result.linksCreated, 2);

        const base = await BaseService.findByIdWithCompanies(baseId);
        assert.ok(base);
        assert.equal(base.companies.length, 2);
        assert.ok(
          base.companies.every((membership) => membership.baseId === baseId)
        );

        const companies = await CompanyService.findAll({ baseId });
        assert.equal(companies.length, 2);
        assert.ok(
          companies.every((company) =>
            company.bases.some((membership) => membership.baseId === baseId)
          )
        );
      }
    );

    await t.test(
      "falha de preparação não cria empresa nem vínculo parcial",
      async () => {
        assert.ok(baseId);

        const context = {
          jobId: randomUUID(),
          baseId,
          fileHash: "f".repeat(64),
        };
        const stagedRow = {
          rowNumber: 2,
          data: {
            cnpj: cnpjs[2],
            corporateName: "Empresa Sintética de Falha",
            tradeName: "",
            segment: "",
            city: "Vitória",
            state: "ES",
            phone: "",
            email: "",
            website: "",
          },
        };

        await ImportService.startJob({
          ...context,
          fileName: "falha-parcial.csv",
          summary: {
            totalRows: 2,
            invalidRows: 0,
            duplicateRows: 0,
            emptyRowsIgnored: 0,
            eligibleRows: 2,
          },
        });
        await ImportService.stageJobRows(context, [stagedRow]);

        await assert.rejects(
          ImportService.finalizeJob(context),
          /recebeu 1 de 2 linhas elegíveis/
        );
        assert.equal(
          await prisma.company.count({ where: { cnpj: cnpjs[2] } }),
          0
        );
        assert.equal(
          await prisma.baseCompany.count({
            where: {
              baseId,
              company: {
                cnpj: cnpjs[2],
              },
            },
          }),
          0
        );
      }
    );

    await t.test("reimportação preserva deduplicação", async () => {
      assert.ok(baseId);

      const { result } = await runImport({
        baseId,
        csvText,
        fileName: "amostra-sintetica.csv",
      });

      assert.equal(result.companiesCreated, 0);
      assert.equal(result.linksCreated, 0);
      assert.equal(result.alreadyInBase, 2);
    });
  } finally {
    if (baseId) {
      await prisma.base.deleteMany({
        where: { id: baseId },
      });
    }
    await prisma.company.deleteMany({
      where: {
        cnpj: {
          in: cnpjs,
        },
      },
    });
    if (previousActiveBase) {
      await prisma.base.updateMany({
        where: { id: previousActiveBase.id },
        data: { isActive: true },
      });
    }
    await prisma.$disconnect();
  }
});
