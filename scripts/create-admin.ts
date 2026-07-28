import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import process from "node:process";

import { PrismaClient } from "@prisma/client";

import { createSalesCockpitAuth } from "../src/lib/auth-config";
import {
  ADMIN_ROLE,
  AdminBootstrapError,
  bootstrapFirstAdmin,
  toSafeBootstrapError,
} from "./lib/admin-bootstrap";

const bootstrapPrisma = new PrismaClient();
const bootstrapLockKey = 8_492_714;

async function promptVisible(label: string) {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await prompt.question(label);
  } finally {
    prompt.close();
  }
}

async function promptHidden(label: string) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new AdminBootstrapError(
      "A senha deve ser informada em um terminal interativo."
    );
  }

  let muted = false;
  const hiddenOutput = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) {
        process.stdout.write(chunk, encoding);
      }
      callback();
    },
  });
  const prompt = createInterface({
    input: process.stdin,
    output: hiddenOutput,
    terminal: true,
  });

  process.stdout.write(label);
  muted = true;

  try {
    return await prompt.question("");
  } finally {
    muted = false;
    process.stdout.write("\n");
    prompt.close();
  }
}

async function promptCredentials() {
  const name = await promptVisible("Nome: ");
  const email = await promptVisible("E-mail: ");
  const password = await promptHidden("Senha: ");
  const passwordConfirmation = await promptHidden("Confirme a senha: ");

  if (password !== passwordConfirmation) {
    throw new AdminBootstrapError("As senhas informadas não coincidem.");
  }

  return {
    name,
    email,
    password,
  };
}

async function main() {
  try {
    if (process.argv.length > 2) {
      throw new AdminBootstrapError(
        "Este comando não aceita credenciais nem outros argumentos."
      );
    }

    if ((process.env.BETTER_AUTH_SECRET?.length ?? 0) < 32) {
      throw new AdminBootstrapError(
        "BETTER_AUTH_SECRET deve ter pelo menos 32 caracteres."
      );
    }

    await bootstrapFirstAdmin({
      databaseUrl: process.env.DATABASE_URL,
      preflight: {
        countActiveAdmins: () =>
          bootstrapPrisma.user.count({
            where: {
              banned: false,
              role: ADMIN_ROLE,
            },
          }),
      },
      promptCredentials,
      runExclusive: (operation) =>
        bootstrapPrisma.$transaction(
          async (transaction) => {
            await transaction.$queryRaw`
              SELECT pg_advisory_xact_lock(${bootstrapLockKey})::text
                AS "lockResult"
            `;

            const transactionAuth = createSalesCockpitAuth(transaction, {
              useAdapterTransactions: false,
              useNextCookies: false,
            });

            await operation({
              countActiveAdmins: () =>
                transaction.user.count({
                  where: {
                    banned: false,
                    role: ADMIN_ROLE,
                  },
                }),
              emailExists: async (email) =>
                Boolean(
                  await transaction.user.findFirst({
                    where: {
                      email: {
                        equals: email,
                        mode: "insensitive",
                      },
                    },
                    select: {
                      id: true,
                    },
                  })
                ),
              createAdmin: (credentials) =>
                transactionAuth.api.createUser({
                  body: credentials,
                }),
            });
          },
          {
            maxWait: 5_000,
            timeout: 15_000,
          }
        ),
      log: (message) => console.log(message),
    });
  } catch (error) {
    console.error(toSafeBootstrapError(error).message);
    process.exitCode = 1;
  } finally {
    await bootstrapPrisma.$disconnect();
  }
}

void main();
