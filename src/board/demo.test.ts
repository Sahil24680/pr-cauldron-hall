import { describe, expect, it } from "vitest";
import type { Board, PullRequest } from "../../shared/board";
import { makePullRequest } from "../../test/factories";
import { type DemoStep, buildDemoSteps, findRestoreEvents } from "./demo";

function boardOf(pullRequests: PullRequest[]): Board {
  return { repo: "example/repo", viewer: "wizard", fetchedAt: "2026-10-19T00:00:00.000Z", pullRequests, events: [] };
}

function runSteps(steps: DemoStep[], board: Board) {
  return steps.reduce(
    (state, step) => {
      const result = step(state.board);
      return result ? { board: result.board, kinds: [...state.kinds, result.event.kind] } : state;
    },
    { board, kinds: [] as string[] },
  );
}

describe("buildDemoSteps", () => {
  it("plays every kind of change, ending with the demo PR closing", () => {
    const reviewing = makePullRequest({ number: 1 });
    const passing = makePullRequest({ number: 2, reviewDecision: "APPROVED" });
    const { board, kinds } = runSteps(buildDemoSteps("wizard"), boardOf([reviewing, passing]));
    expect(kinds).toEqual(["moved", "ci-failed", "merged", "opened", "moved", "conflict", "closed"]);
    expect(board.pullRequests.map((pr) => pr.number)).toEqual([2]);
    expect(board.pullRequests[0]?.mergeable).toBe("CONFLICTING");
  });

  it("chains the demo PR when no real PR can take a conflict", () => {
    const reviewing = makePullRequest({ number: 1 });
    const draft = makePullRequest({ number: 2, isDraft: true });
    const steps = buildDemoSteps("wizard");
    const beforeConflict = runSteps(steps.slice(0, 5), boardOf([reviewing, draft])).board;
    const conflict = steps[5]?.(beforeConflict);
    expect(conflict?.event.kind).toBe("conflict");
    expect(conflict?.event.number).toBe(99_999);
  });
});

describe("findRestoreEvents", () => {
  it("walks removed PRs back in and sends added ones away", () => {
    const kept = makePullRequest({ number: 1 });
    const merged = makePullRequest({ number: 2, reviewDecision: "APPROVED" });
    const added = makePullRequest({ number: 3 });
    const events = findRestoreEvents(boardOf([kept, added]), boardOf([kept, merged]));
    expect(events.map(({ kind, number, from, to }) => ({ kind, number, from, to }))).toEqual([
      { kind: "opened", number: 2, from: undefined, to: "approved" },
      { kind: "closed", number: 3, from: "review", to: undefined },
    ]);
  });
});
