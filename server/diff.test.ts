import { describe, expect, it } from "vitest";
import { makePullRequest } from "../test/factories";
import { diffPullRequests, keepKnownMergeable } from "./diff";
import type { ClosedOutcome } from "./github";

const AT = "2026-10-19T00:00:00.000Z";
const noOutcomes = new Map<number, ClosedOutcome>();

function kinds(...args: Parameters<typeof diffPullRequests>) {
  return diffPullRequests(...args).map((event) => event.kind);
}

describe("diffPullRequests", () => {
  it("reports a new PR as opened in its stage", () => {
    const [event] = diffPullRequests([], [makePullRequest({ number: 2 })], noOutcomes, AT);
    expect(event).toMatchObject({ kind: "opened", number: 2, to: "review", at: AT });
  });

  it("reports a stage change with where it came from and went", () => {
    const [event] = diffPullRequests([makePullRequest()], [makePullRequest({ reviewDecision: "APPROVED" })], noOutcomes, AT);
    expect(event).toMatchObject({ kind: "moved", from: "review", to: "approved" });
  });

  it("reports CI turning red, and turning green again only from red", () => {
    const green = makePullRequest();
    const red = makePullRequest({ checks: { passing: 2, failing: ["test"], running: [] } });
    const running = makePullRequest({ checks: { passing: 2, failing: [], running: ["test"] } });
    expect(kinds([green], [red], noOutcomes, AT)).toEqual(["ci-failed"]);
    expect(kinds([red], [green], noOutcomes, AT)).toEqual(["ci-passed"]);
    expect(kinds([running], [green], noOutcomes, AT)).toEqual([]);
  });

  it("reports a new merge conflict once", () => {
    const conflicted = makePullRequest({ mergeable: "CONFLICTING" });
    expect(kinds([makePullRequest()], [conflicted], noOutcomes, AT)).toEqual(["conflict"]);
    expect(kinds([conflicted], [conflicted], noOutcomes, AT)).toEqual([]);
  });

  it("tells merged from closed for PRs that left, defaulting to closed", () => {
    const outcomes = new Map<number, ClosedOutcome>([[1, "merged"]]);
    expect(kinds([makePullRequest({ number: 1 }), makePullRequest({ number: 2 })], [], outcomes, AT)).toEqual(["merged", "closed"]);
  });
});

describe("keepKnownMergeable", () => {
  it("keeps the last known mergeability while GitHub reports UNKNOWN", () => {
    const before = makePullRequest({ mergeable: "CONFLICTING" });
    expect(keepKnownMergeable(makePullRequest({ mergeable: "UNKNOWN" }), before).mergeable).toBe("CONFLICTING");
    expect(keepKnownMergeable(makePullRequest({ mergeable: "UNKNOWN" }), undefined).mergeable).toBe("UNKNOWN");
    expect(keepKnownMergeable(makePullRequest({ mergeable: "MERGEABLE" }), before).mergeable).toBe("MERGEABLE");
  });
});
