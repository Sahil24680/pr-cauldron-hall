import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const REPO_PART = /^[\w.-]+$/;

const environmentSchema = z.object({
  PR_BOARD_REPO: z.string({ required_error: "Set PR_BOARD_REPO to the repository to watch, like PR_BOARD_REPO=owner/name npm run dev" }),
  PR_BOARD_PORT: z.coerce.number().int().positive().default(4848),
  PR_BOARD_SCOPE: z.enum(["mine", "all"]).default("mine"),
  PR_BOARD_INTERVAL_SECONDS: z.coerce.number().positive().default(60),
  NODE_ENV: z.string().optional(),
});

export type Config = {
  repo: string;
  owner: string;
  name: string;
  port: number;
  scope: "mine" | "all";
  pollIntervalMs: number;
  isProduction: boolean;
  stateFile: string;
  castFile: string;
  distDirectory: string;
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    throw new RangeError(result.error.issues.map((issue) => issue.message).join("\n"));
  }
  const parsed = result.data;
  const [owner, name] = parsed.PR_BOARD_REPO.split("/");
  if (!owner || !name || !REPO_PART.test(owner) || !REPO_PART.test(name)) {
    throw new RangeError(`PR_BOARD_REPO must look like owner/name, got "${parsed.PR_BOARD_REPO}"`);
  }
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  return {
    repo: parsed.PR_BOARD_REPO,
    owner,
    name,
    port: parsed.PR_BOARD_PORT,
    scope: parsed.PR_BOARD_SCOPE,
    pollIntervalMs: parsed.PR_BOARD_INTERVAL_SECONDS * 1000,
    isProduction: parsed.NODE_ENV === "production",
    stateFile: path.join(root, ".data", `board-${parsed.PR_BOARD_SCOPE}.json`),
    castFile: path.join(root, "shared", "cast.json"),
    distDirectory: path.join(root, "dist"),
  };
}
