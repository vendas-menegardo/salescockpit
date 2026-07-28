import test from "node:test";
import assert from "node:assert/strict";

import {
  APP_ROLES,
  canAccessRoute,
  isAdminRole,
} from "../src/features/auth/lib/access-control.ts";
import { loginSchema } from "../src/features/auth/validations/auth-schema.ts";
import { validateUserUpdatePolicy } from "../src/features/users/lib/user-policy.ts";

test("reconhece somente o perfil administrativo esperado", () => {
  assert.equal(isAdminRole(APP_ROLES.ADMIN), true);
  assert.equal(isAdminRole(APP_ROLES.USER), false);
  assert.equal(isAdminRole(undefined), false);
});

test("USER não acessa rotas administrativas pelo mapa de navegação", () => {
  assert.equal(canAccessRoute(APP_ROLES.USER, "/usuarios"), false);
  assert.equal(canAccessRoute(APP_ROLES.USER, "/usuarios/novo"), false);
  assert.equal(canAccessRoute(APP_ROLES.USER, "/importacao"), false);
  assert.equal(canAccessRoute(APP_ROLES.USER, "/empresas"), true);
  assert.equal(canAccessRoute(APP_ROLES.USER, "/bases"), true);
});

test("ADMIN acessa rotas administrativas", () => {
  assert.equal(canAccessRoute(APP_ROLES.ADMIN, "/usuarios"), true);
  assert.equal(canAccessRoute(APP_ROLES.ADMIN, "/importacao"), true);
});

test("validação de login rejeita entrada inválida sem consultar banco", () => {
  assert.equal(
    loginSchema.safeParse({ email: "invalido", password: "" }).success,
    false
  );
  assert.equal(
    loginSchema.safeParse({
      email: "usuario@empresa.com.br",
      password: "senha-informada",
    }).success,
    true
  );
});

test("administrador não pode desativar ou rebaixar a própria conta", () => {
  const baseInput = {
    activeAdminCount: 2,
    currentRole: APP_ROLES.ADMIN,
    currentUserId: "admin-1",
    targetUserId: "admin-1",
    targetWasActive: true,
  };

  assert.match(
    validateUserUpdatePolicy({
      ...baseInput,
      nextActive: false,
      nextRole: APP_ROLES.ADMIN,
    }),
    /próprio acesso/
  );
  assert.match(
    validateUserUpdatePolicy({
      ...baseInput,
      nextActive: true,
      nextRole: APP_ROLES.USER,
    }),
    /próprio acesso/
  );
});

test("último administrador ativo não pode ser removido", () => {
  assert.match(
    validateUserUpdatePolicy({
      activeAdminCount: 1,
      currentRole: APP_ROLES.ADMIN,
      currentUserId: "admin-1",
      nextActive: false,
      nextRole: APP_ROLES.ADMIN,
      targetUserId: "admin-2",
      targetWasActive: true,
    }),
    /último administrador/
  );
});

test("alterações seguras de usuários permanecem permitidas", () => {
  assert.equal(
    validateUserUpdatePolicy({
      activeAdminCount: 2,
      currentRole: APP_ROLES.ADMIN,
      currentUserId: "admin-1",
      nextActive: false,
      nextRole: APP_ROLES.USER,
      targetUserId: "admin-2",
      targetWasActive: true,
    }),
    null
  );
  assert.equal(
    validateUserUpdatePolicy({
      activeAdminCount: 1,
      currentRole: APP_ROLES.USER,
      currentUserId: "admin-1",
      nextActive: true,
      nextRole: APP_ROLES.USER,
      targetUserId: "user-1",
      targetWasActive: false,
    }),
    null
  );
});
