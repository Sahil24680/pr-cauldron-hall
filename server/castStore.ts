import { execFile } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { type Appearance, type Cast, type CastKey, fitToBuild, mergeCast } from "../shared/cast";

export async function loadCast(file: string): Promise<Cast> {
  try {
    return mergeCast(JSON.parse(await readFile(file, "utf8")));
  } catch {
    return mergeCast(null);
  }
}

// Written to a temporary file and renamed, so a crash mid-write never leaves a half-written cast behind.
export async function saveCastMember(file: string, key: CastKey, appearance: Appearance) {
  const cast = { ...(await loadCast(file)), [key]: fitToBuild(appearance) };
  const pending = `${file}.${process.pid}.tmp`;
  await writeFile(pending, `${JSON.stringify(cast, null, 2)}\n`);
  await rename(pending, file);
  return cast;
}

// The cast as last committed to git; a folder with no history has nothing older than the file itself.
async function loadCommittedCast(file: string): Promise<Cast> {
  const committed = await promisify(execFile)("git", ["show", `HEAD:./${path.basename(file)}`], { cwd: path.dirname(file) })
    .then(({ stdout }): unknown => JSON.parse(stdout))
    .catch(() => undefined);
  return committed === undefined ? loadCast(file) : mergeCast(committed);
}

export async function resetCastMember(file: string, key: CastKey) {
  const committed = await loadCommittedCast(file);
  return saveCastMember(file, key, committed[key]);
}
