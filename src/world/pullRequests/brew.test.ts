import { describe, expect, it } from "vitest";
import { makePullRequest } from "../../../test/factories";
import { summariseBrew } from "./brew";

const NOW = new Date("2026-10-18T12:00:00.000Z").getTime();
const passing = makePullRequest({ number: 1 });
const failing = makePullRequest({ number: 2, checks: { passing: 3, failing: ["lint"], running: [] } });
const ready = makePullRequest({ number: 3, reviewDecision: "APPROVED" });
const conflicted = makePullRequest({ number: 4, mergeable: "CONFLICTING" });
const stale = makePullRequest({ number: 5, updatedAt: "2026-09-01T00:00:00.000Z" });

describe("summariseBrew", () => {
  it("shows the most urgent CI in the stack", () => {
    expect(summariseBrew([passing, failing], NOW)?.ci).toBe("failing");
    expect(summariseBrew([passing, makePullRequest({ checks: { passing: 0, failing: [], running: ["build"] } })], NOW)?.ci).toBe("running");
  });

  it("is ready or chained when any one PR is", () => {
    const brew = summariseBrew([passing, ready, conflicted], NOW);
    expect(brew?.ready).toBe(true);
    expect(brew?.conflicted).toBe(true);
    expect(summariseBrew([passing], NOW)?.conflicted).toBe(false);
  });

  it("goes stale only when every PR has gone quiet", () => {
    expect(summariseBrew([stale, passing], NOW)?.stale).toBe(false);
    expect(summariseBrew([stale], NOW)?.stale).toBe(true);
  });

  it("has nothing to brew for an empty stack", () => {
    expect(summariseBrew([], NOW)).toBeNull();
  });
});
