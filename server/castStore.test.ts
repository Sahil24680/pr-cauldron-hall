import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_CAST } from "../shared/cast";
import { loadCast, resetCastMember, saveCastMember } from "./castStore";

async function castFile(contents?: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "cast-"));
  const file = path.join(directory, "cast.json");
  if (contents !== undefined) {
    await writeFile(file, contents);
  }
  return { directory, file };
}

describe("loadCast", () => {
  it("serves the built cast when the file is missing or unreadable", async () => {
    expect(await loadCast((await castFile()).file)).toEqual(DEFAULT_CAST);
    expect(await loadCast((await castFile("{ not json")).file)).toEqual(DEFAULT_CAST);
  });
});

describe("saveCastMember", () => {
  it("rewrites only the edited member, as readable JSON ending in a newline", async () => {
    const { directory, file } = await castFile(JSON.stringify(DEFAULT_CAST));
    const edited = { ...DEFAULT_CAST.changes, hairColor: "#123456" };

    const saved = await saveCastMember(file, "changes", edited);

    const written = await readFile(file, "utf8");
    expect(written.endsWith("}\n")).toBe(true);
    expect(JSON.parse(written)).toEqual({ ...DEFAULT_CAST, changes: edited });
    expect(saved.changes.hairColor).toBe("#123456");
    expect(await readdir(directory)).toEqual(["cast.json"]);
  });
});

describe("resetCastMember", () => {
  it("puts back the member as last committed and keeps the others as saved", async () => {
    const { directory, file } = await castFile(JSON.stringify(DEFAULT_CAST));
    const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd: directory });
    git("init", "--quiet");
    git("add", "cast.json");
    git("commit", "--quiet", "-m", "cast");
    await saveCastMember(file, "draft", { ...DEFAULT_CAST.draft, hairColor: "#123456" });
    await saveCastMember(file, "review", { ...DEFAULT_CAST.review, hairColor: "#654321" });

    const reset = await resetCastMember(file, "draft");

    expect(reset.draft).toEqual(DEFAULT_CAST.draft);
    expect(reset.review.hairColor).toBe("#654321");
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(reset);
  });

  it("keeps the saved member when the folder has no git history", async () => {
    const { file } = await castFile(JSON.stringify({ ...DEFAULT_CAST, draft: { ...DEFAULT_CAST.draft, hairColor: "#123456" } }));
    expect((await resetCastMember(file, "draft")).draft.hairColor).toBe("#123456");
  });
});
