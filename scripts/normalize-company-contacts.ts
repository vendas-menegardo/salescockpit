import { PrismaClient } from "@prisma/client";

import { planCompanyContactBackfill } from "../src/features/companies/lib/contact-backfill";

const PRODUCTION_HOSTS = new Set([
  "ep-sparkling-salad-acthg52d.sa-east-1.aws.neon.tech",
  "ep-sparkling-salad-acthg52d-pooler.sa-east-1.aws.neon.tech",
]);
const BATCH_SIZE = 10;

function databaseHost() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL não configurada.");
  return new URL(raw).hostname;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const host = databaseHost();
  if (apply && PRODUCTION_HOSTS.has(host)) {
    throw new Error("Aplicação bloqueada no banco de produção.");
  }

  const prisma = new PrismaClient();
  try {
    const [companiesBefore, membershipsBefore, contactsBefore] = await Promise.all([
      prisma.company.count(),
      prisma.baseCompany.count(),
      prisma.companyContact.count(),
    ]);
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        phone: true,
        email: true,
        contacts: {
          select: {
            id: true,
            type: true,
            value: true,
            originalValue: true,
            canonicalValue: true,
            isPrimary: true,
            archivedAt: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });
    const plans = companies.map((company) =>
      planCompanyContactBackfill(company, company.contacts)
    );
    const report = {
      mode: apply ? "apply" : "dry-run",
      host,
      companiesBefore,
      membershipsBefore,
      contactsBefore,
      affectedCompanies: plans.filter(
        (plan) => plan.creates.length > 0 || plan.updates.length > 0
      ).length,
      contactsToCreate: plans.reduce((total, plan) => total + plan.creates.length, 0),
      contactsToUpdate: plans.reduce((total, plan) => total + plan.updates.length, 0),
      ambiguities: plans.reduce(
        (total, plan) => total + plan.ambiguities.length,
        0
      ),
    };

    if (apply) {
      for (let index = 0; index < plans.length; index += BATCH_SIZE) {
        const batch = plans.slice(index, index + BATCH_SIZE);
        await prisma.$transaction(async (tx) => {
          for (const plan of batch) {
            for (const update of plan.updates) {
              await tx.companyContact.update({
                where: { id: update.contactId },
                data: {
                  originalValue: update.originalValue,
                  canonicalValue: update.canonicalValue,
                },
              });
            }
            for (const create of plan.creates) {
              await tx.companyContact.create({
                data: {
                  ...create,
                  source: "DADOS_LEGADOS",
                  events: {
                    create: {
                      companyId: create.companyId,
                      type: "CREATED",
                      reason:
                        "Contato materializado pelo normalizador retroativo.",
                      nextState: {
                        type: create.type,
                        value: create.value,
                        canonicalValue: create.canonicalValue,
                        isPrimary: create.isPrimary,
                      },
                    },
                  },
                },
              });
            }
          }
        });
      }
    }

    const [companiesAfter, membershipsAfter, contactsAfter] = await Promise.all([
      prisma.company.count(),
      prisma.baseCompany.count(),
      prisma.companyContact.count(),
    ]);
    console.log(
      JSON.stringify(
        {
          ...report,
          companiesAfter,
          membershipsAfter,
          contactsAfter,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha no normalizador.");
  process.exitCode = 1;
});
