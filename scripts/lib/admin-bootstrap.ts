import { z } from "zod";

export const ADMIN_ROLE = "admin";
export const ALLOWED_DATABASE_HOST =
  "ep-soft-sky-ac9ou8si-pooler.sa-east-1.aws.neon.tech";
export const PRODUCTION_DATABASE_HOST =
  "ep-sparkling-salad-acthg52d.sa-east-1.aws.neon.tech";
export const ADMIN_CREATED_MESSAGE =
  "Primeiro administrador criado com segurança no banco isolado.";

const productionHosts = new Set([
  PRODUCTION_DATABASE_HOST,
  "ep-sparkling-salad-acthg52d-pooler.sa-east-1.aws.neon.tech",
]);

const credentialsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe um nome com pelo menos 2 caracteres.")
    .max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail válido.")
    .max(320),
  password: z
    .string()
    .min(12, "A senha deve ter pelo menos 12 caracteres.")
    .max(128, "A senha deve ter no máximo 128 caracteres."),
});

export class AdminBootstrapError extends Error {}

type Credentials = z.infer<typeof credentialsSchema>;

type BootstrapDatabase = {
  countActiveAdmins: () => Promise<number>;
  createAdmin: (
    credentials: Credentials & { role: typeof ADMIN_ROLE }
  ) => Promise<{
    user?: {
      role?: string | null;
    };
  }>;
  emailExists: (email: string) => Promise<boolean>;
};

type BootstrapDependencies = {
  databaseUrl: string | undefined;
  log: (message: string) => void;
  preflight: Pick<BootstrapDatabase, "countActiveAdmins">;
  promptCredentials: () => Promise<Credentials>;
  runExclusive: (
    operation: (database: BootstrapDatabase) => Promise<void>
  ) => Promise<void>;
};

export function validateDatabaseTarget(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    throw new AdminBootstrapError("DATABASE_URL não está configurada.");
  }

  let parsed: URL;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new AdminBootstrapError("DATABASE_URL não possui um formato válido.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new AdminBootstrapError("DATABASE_URL deve apontar para PostgreSQL.");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (productionHosts.has(hostname)) {
    throw new AdminBootstrapError(
      `Operação bloqueada: ${hostname} é um host de produção.`
    );
  }

  if (hostname !== ALLOWED_DATABASE_HOST) {
    throw new AdminBootstrapError(
      `Operação bloqueada: o host ${hostname || "(ausente)"} não é a branch isolada autorizada.`
    );
  }

  return {
    hostname,
  };
}

export function toSafeBootstrapError(error: unknown) {
  if (error instanceof AdminBootstrapError) {
    return error;
  }

  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  const message = error instanceof Error ? error.message : "";

  if (code === "P2010" && message.includes("column of type 'void'")) {
    return new AdminBootstrapError(
      "Não foi possível obter o bloqueio seguro no banco isolado. O cadastro não foi iniciado."
    );
  }

  if (["P1001", "P1002"].includes(code)) {
    return new AdminBootstrapError(
      "Não foi possível conectar ao banco isolado autorizado."
    );
  }

  if (code === "P2021") {
    return new AdminBootstrapError(
      "As tabelas de autenticação ainda não estão disponíveis no banco isolado."
    );
  }

  if (code === "P2028") {
    return new AdminBootstrapError(
      "A seção segura do bootstrap expirou antes da conclusão. Nenhum cadastro foi confirmado."
    );
  }

  return new AdminBootstrapError(
    "Não foi possível concluir o bootstrap no banco isolado. Nenhum cadastro foi confirmado."
  );
}

export async function bootstrapFirstAdmin(
  dependencies: BootstrapDependencies
) {
  validateDatabaseTarget(dependencies.databaseUrl);

  if ((await dependencies.preflight.countActiveAdmins()) > 0) {
    throw new AdminBootstrapError(
      "Bootstrap recusado: já existe um administrador ativo."
    );
  }

  const promptedCredentials = await dependencies.promptCredentials();
  const parsedCredentials = credentialsSchema.safeParse(promptedCredentials);

  if (!parsedCredentials.success) {
    throw new AdminBootstrapError(
      parsedCredentials.error.issues[0]?.message ??
        "Os dados informados são inválidos."
    );
  }

  try {
    await dependencies.runExclusive(async (database) => {
      if ((await database.countActiveAdmins()) > 0) {
        throw new AdminBootstrapError(
          "Bootstrap recusado: já existe um administrador ativo."
        );
      }

      if (await database.emailExists(parsedCredentials.data.email)) {
        throw new AdminBootstrapError(
          "Bootstrap recusado: o e-mail já está cadastrado."
        );
      }

      let result;

      try {
        result = await database.createAdmin({
          ...parsedCredentials.data,
          role: ADMIN_ROLE,
        });
      } catch {
        throw new AdminBootstrapError(
          "O Better Auth não conseguiu criar a credencial administrativa. A transação foi revertida."
        );
      }

      if (result.user?.role !== ADMIN_ROLE) {
        throw new AdminBootstrapError(
          "A conta retornou sem o perfil administrativo esperado. A transação foi revertida."
        );
      }
    });
  } catch (error) {
    throw toSafeBootstrapError(error);
  }

  dependencies.log(ADMIN_CREATED_MESSAGE);
}
