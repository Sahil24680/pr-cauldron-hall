import { describe, expect, it } from "vitest";
import { isTestPath, summarizeChanges } from "./changes";

describe("isTestPath", () => {
  it.each([
    "packages/db/src/repos/user.repo.test.ts",
    "apps/web/lib/useThing.spec.tsx",
    "src/__tests__/thing.ts",
    "tests/helpers.ts",
    "packages/api/test/setup.ts",
    "apps/web/e2e/login.ts",
    "playwright/auth.setup.ts",
    "packages/db/fixtures/users.json",
    "src/__fixtures__/board.json",
    "src/__snapshots__/Card.tsx.snap",
    "src/Card.test.tsx.snap",
    "Apps/Web/E2E/Login.ts",
  ])("counts %s as test code", (path) => {
    expect(isTestPath(path)).toBe(true);
  });

  it.each([
    "packages/db/src/repos/user.repo.ts",
    "apps/web/lib/testing-library.ts",
    "src/latest/thing.ts",
    "src/contest.ts",
    "docs/testing.md",
    "playwright.config.ts",
  ])("counts %s as real code", (path) => {
    expect(isTestPath(path)).toBe(false);
  });
});

describe("summarizeChanges", () => {
  const files = [
    { path: "src/spell.ts", additions: 100, deletions: 20 },
    { path: "src/wand.ts", additions: 20, deletions: 10 },
    { path: "src/spell.test.ts", additions: 80, deletions: 5 },
  ];

  it("adds up lines for code and tests separately", () => {
    expect(summarizeChanges(files, 3)).toEqual({
      code: { additions: 120, deletions: 30 },
      tests: { additions: 80, deletions: 5 },
      partial: false,
    });
  });

  it("marks the summary partial when GitHub returned fewer files than the PR changed", () => {
    expect(summarizeChanges(files, 150).partial).toBe(true);
  });
});
