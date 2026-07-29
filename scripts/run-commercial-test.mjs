import { spawnSync } from "node:child_process";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const compiledModules = join(
  projectRoot,
  "node_modules",
  "next",
  "dist",
  "compiled"
);
const nodePath = process.env.NODE_PATH
  ? `${compiledModules}${delimiter}${process.env.NODE_PATH}`
  : compiledModules;
const result = spawnSync(
  process.execPath,
  [
    "--env-file=.env",
    "--conditions=react-server",
    "--import",
    "tsx",
    "--test",
    "scripts/commercial-operation.integration.mjs",
  ],
  {
    cwd: projectRoot,
    env: { ...process.env, NODE_PATH: nodePath },
    stdio: "inherit",
  }
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
