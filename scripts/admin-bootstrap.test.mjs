import test from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_CREATED_MESSAGE,
  ADMIN_ROLE,
  ALLOWED_DATABASE_HOST,
  PRODUCTION_DATABASE_HOST,
  bootstrapFirstAdmin,
} from "./lib/admin-bootstrap.ts";
import { APP_ROLES } from "../src/features/auth/lib/access-control.ts";

const allowedDatabaseUrl = `postgresql://user:secret@${ALLOWED_DATABASE_HOST}/salescockpit`;

test("usa o mesmo valor de perfil ADMIN da aplicação", () => {
  assert.equal(ADMIN_ROLE, APP_ROLES.ADMIN);
});

function createDependencies(overrides = {}) {
  const calls = {
    createAdmin: [],
    logs: [],
    prompts: 0,
  };
  const database = {
    countActiveAdmins: async () => 0,
    emailExists: async () => false,
    ...overrides.database,
  };
  const dependencies = {
    databaseUrl: allowedDatabaseUrl,
    preflight: {
      countActiveAdmins: async () => 0,
      ...overrides.preflight,
    },
    promptCredentials: async () => {
      calls.prompts += 1;

      return {
        name: "  Administrador Inicial  ",
        email: "ADMIN@EXAMPLE.COM",
        password: "senha-forte-sem-vazamento",
      };
    },
    runExclusive: async (operation) => operation(database),
    createAdmin: async (credentials) => {
      calls.createAdmin.push(credentials);

      return {
        user: {
          role: ADMIN_ROLE,
        },
      };
    },
    log: (message) => calls.logs.push(message),
    ...overrides.dependencies,
  };

  return {
    calls,
    dependencies,
  };
}

test("bloqueia explicitamente o banco de produção antes de qualquer prompt", async () => {
  const { calls, dependencies } = createDependencies({
    dependencies: {
      databaseUrl: `postgresql://user:secret@${PRODUCTION_DATABASE_HOST}/salescockpit`,
    },
  });

  await assert.rejects(
    bootstrapFirstAdmin(dependencies),
    /host de produção/
  );
  assert.equal(calls.prompts, 0);
  assert.equal(calls.createAdmin.length, 0);
});

test("bloqueia qualquer host diferente da branch isolada autorizada", async () => {
  const { calls, dependencies } = createDependencies({
    dependencies: {
      databaseUrl:
        "postgresql://user:secret@ep-outra-branch.sa-east-1.aws.neon.tech/salescockpit",
    },
  });

  await assert.rejects(
    bootstrapFirstAdmin(dependencies),
    /não é a branch isolada autorizada/
  );
  assert.equal(calls.prompts, 0);
  assert.equal(calls.createAdmin.length, 0);
});

test("recusa o bootstrap quando já existe ADMIN ativo", async () => {
  const { calls, dependencies } = createDependencies({
    preflight: {
      countActiveAdmins: async () => 1,
    },
  });

  await assert.rejects(
    bootstrapFirstAdmin(dependencies),
    /já existe um administrador ativo/
  );
  assert.equal(calls.prompts, 0);
  assert.equal(calls.createAdmin.length, 0);
});

test("repete a verificação de ADMIN ativo dentro da seção exclusiva", async () => {
  const { calls, dependencies } = createDependencies({
    database: {
      countActiveAdmins: async () => 1,
    },
  });

  await assert.rejects(
    bootstrapFirstAdmin(dependencies),
    /já existe um administrador ativo/
  );
  assert.equal(calls.prompts, 1);
  assert.equal(calls.createAdmin.length, 0);
});

test("recusa e-mail duplicado antes da API de criação", async () => {
  const { calls, dependencies } = createDependencies({
    database: {
      emailExists: async () => true,
    },
  });

  await assert.rejects(
    bootstrapFirstAdmin(dependencies),
    /e-mail já está cadastrado/
  );
  assert.equal(calls.createAdmin.length, 0);
});

test("cria o primeiro usuário com o perfil ADMIN esperado", async () => {
  const { calls, dependencies } = createDependencies();

  await bootstrapFirstAdmin(dependencies);

  assert.deepEqual(calls.createAdmin, [
    {
      name: "Administrador Inicial",
      email: "admin@example.com",
      password: "senha-forte-sem-vazamento",
      role: ADMIN_ROLE,
    },
  ]);
  assert.deepEqual(calls.logs, [ADMIN_CREATED_MESSAGE]);
});

test("não inclui a senha em nenhuma mensagem de log", async () => {
  const password = "segredo-que-nao-pode-aparecer";
  const { calls, dependencies } = createDependencies({
    dependencies: {
      promptCredentials: async () => ({
        name: "Administrador",
        email: "admin@example.com",
        password,
      }),
    },
  });

  await bootstrapFirstAdmin(dependencies);

  assert.equal(calls.logs.join("\n").includes(password), false);
  assert.deepEqual(calls.logs, [ADMIN_CREATED_MESSAGE]);
});
