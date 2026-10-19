import { describe, expect, it } from "vitest";
import { makePullRequest } from "../test/factories";
import { findCiState, findStage, isReadyToMerge, isStale } from "./stage";

const NOW = new Date("2026-10-19T00:00:00.000Z").getTime();

describe("findStage", () => {
  it("puts drafts in the draft stage whatever their review state", () => {
    expect(findStage(makePullRequest({ isDraft: true, reviewDecision: "APPROVED" }))).toBe("draft");
  });

  it("maps review decisions to stages", () => {
    expect(findStage(makePullRequest({ reviewDecision: "CHANGES_REQUESTED" }))).toBe("changes");
    expect(findStage(makePullRequest({ reviewDecision: "APPROVED" }))).toBe("approved");
    expect(findStage(makePullRequest({ reviewDecision: "REVIEW_REQUIRED" }))).toBe("review");
    expect(findStage(makePullRequest({ reviewDecision: null }))).toBe("review");
  });
});

describe("findCiState", () => {
  it("lets one failing check outrank running and passing ones", () => {
    expect(findCiState(makePullRequest({ checks: { passing: 4, failing: ["lint"], running: ["test"] } }))).toBe("failing");
  });

  it("reports running before passing, and none without checks", () => {
    expect(findCiState(makePullRequest({ checks: { passing: 4, failing: [], running: ["test"] } }))).toBe("running");
    expect(findCiState(makePullRequest({ checks: { passing: 4, failing: [], running: [] } }))).toBe("passing");
    expect(findCiState(makePullRequest({ checks: { passing: 0, failing: [], running: [] } }))).toBe("none");
  });
});

describe("isReadyToMerge", () => {
  const ready = makePullRequest({ reviewDecision: "APPROVED" });

  it("needs approval, green checks, no conflict and no parent PR", () => {
    expect(isReadyToMerge(ready)).toBe(true);
    expect(isReadyToMerge({ ...ready, mergeable: "CONFLICTING" })).toBe(false);
    expect(isReadyToMerge({ ...ready, parent: 7 })).toBe(false);
    expect(isReadyToMerge({ ...ready, checks: { passing: 3, failing: [], running: ["build"] } })).toBe(false);
  });
});

describe("isStale", () => {
  it("is stale after seven days without an update", () => {
    expect(isStale(makePullRequest({ updatedAt: "2026-10-11T23:00:00.000Z" }), NOW)).toBe(true);
    expect(isStale(makePullRequest({ updatedAt: "2026-10-13T00:00:00.000Z" }), NOW)).toBe(false);
  });
});
