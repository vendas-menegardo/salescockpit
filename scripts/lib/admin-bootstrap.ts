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
  emailExists: (email: string) => Promise<boolean>;
};

type BootstrapDependencies = {
  createAdmin: (
    credentials: Credentials & { role: typeof ADMIN_ROLE }
  ) => Promise<{
    user?: {
      role?: string | null;
    };
  }>;
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
      result = await dependencies.createAdmin({
        ...parsedCredentials.data,
        role: ADMIN_ROLE,
      });
    } catch {
      if (await database.emailExists(parsedCredentials.data.email)) {
        throw new AdminBootstrapError(
          "Bootstrap recusado: o e-mail já está cadastrado."
        );
      }

      throw new AdminBootstrapError(
        "Não foi possível criar o administrador no banco isolado."
      );
    }

    if (result.user?.role !== ADMIN_ROLE) {
      throw new AdminBootstrapError(
        "A conta foi criada sem o perfil administrativo esperado."
      );
    }
  });

  dependencies.log(ADMIN_CREATED_MESSAGE);
}
