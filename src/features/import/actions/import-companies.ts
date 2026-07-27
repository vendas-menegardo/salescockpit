"use server";

import { prisma } from "@/lib/prisma";

type CsvRow = Record<string, string>;

type ImportCompaniesInput = {
  baseId: string;
  rows: CsvRow[];
};

function normalize(value?: string) {
  return value?.trim() || "";
}

function normalizeCnpj(value?: string) {
  return (value || "").replace(/\D/g, "");
}

export async function importCompanies({
  baseId,
  rows,
}: ImportCompaniesInput) {
  let imported = 0;
  let duplicated = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const cnpj = normalizeCnpj(
        row.CNPJ ??
          row.cnpj ??
          row.Cnpj
      );

      if (cnpj) {
        const exists = await prisma.company.findUnique({
          where: {
            cnpj,
          },
        });

        if (exists) {
          duplicated++;
          continue;
        }
      }

      await prisma.company.create({
        data: {
          baseId,

          corporateName:
            normalize(
              row["Razão Social"] ??
                row["RAZAO SOCIAL"] ??
                row.razao_social ??
                row.razaoSocial ??
                row.corporateName
            ) || "Sem nome",

          tradeName: normalize(
            row["Nome Fantasia"] ??
              row.fantasia ??
              row.tradeName
          ),

          cnpj,

          email: normalize(row.email),

          phone: normalize(
            row.telefone ??
              row.Telefone ??
              row.phone
          ),

          website: normalize(
            row.site ??
              row.website
          ),

          city: normalize(
            row.cidade ??
              row.Cidade
          ),

          state: normalize(
            row.uf ??
              row.UF ??
              row.estado
          ),

          segment: normalize(
            row.segmento ??
              row.segment
          ),

          contactName: normalize(
            row.contato ??
              row.responsavel
          ),
        },
      });

      imported++;
    } catch {
      errors++;
    }
  }

  await prisma.base.update({
    where: {
      id: baseId,
    },
    data: {
      companiesCount: {
        increment: imported,
      },
    },
  });

  return {
    imported,
    duplicated,
    errors,
  };
}