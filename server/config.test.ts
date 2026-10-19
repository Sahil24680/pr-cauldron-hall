import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

describe("loadConfig", () => {
  it("watches the viewer's own PRs in the given repo every minute by default", () => {
    const config = loadConfig({ PR_BOARD_REPO: "octo/cat" });
    expect(config).toMatchObject({ owner: "octo", name: "cat", scope: "mine", port: 4848, pollIntervalMs: 60_000 });
    expect(config.stateFile).toMatch(/board-mine\.json$/);
  });

  it("reads overrides from the environment", () => {
    const config = loadConfig({ PR_BOARD_REPO: "octo/cat", PR_BOARD_SCOPE: "all", PR_BOARD_PORT: "5000", PR_BOARD_INTERVAL_SECONDS: "30" });
    expect(config).toMatchObject({ owner: "octo", name: "cat", scope: "all", port: 5000, pollIntervalMs: 30_000 });
  });

  it("asks for a repo when none is set", () => {
    expect(() => loadConfig({})).toThrow(/PR_BOARD_REPO/);
  });

  it("rejects a repo that is not owner/name", () => {
    expect(() => loadConfig({ PR_BOARD_REPO: "just-a-name" })).toThrow(RangeError);
    expect(() => loadConfig({ PR_BOARD_REPO: 'octo/cat") { evil }' })).toThrow(RangeError);
  });
});
