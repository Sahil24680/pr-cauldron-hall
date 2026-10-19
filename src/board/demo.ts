import type { Board, BoardEvent, BoardEventKind, PullRequest } from "../../shared/board";
import { findCiState, findStage } from "../../shared/stage";

export type DemoStep = (board: Board) => { board: Board; event: BoardEvent } | null;

const DEMO_PR_NUMBER = 99_999;

function eventFor(pr: PullRequest, kind: BoardEventKind, extra: Pick<BoardEvent, "from" | "to"> = {}): BoardEvent {
  return {
    id: `demo-${kind}-${pr.number}-${Date.now()}`,
    at: new Date().toISOString(),
    kind,
    number: pr.number,
    title: pr.title,
    author: pr.author,
    authorName: pr.authorName,
    ...extra,
  };
}

function replace(board: Board, next: PullRequest, event: BoardEvent) {
  return {
    board: { ...board, pullRequests: board.pullRequests.map((pr) => (pr.number === next.number ? next : pr)), events: [event, ...board.events] },
    event,
  };
}

export function buildDemoSteps(viewer: string): DemoStep[] {
  let approvedNumber: number | null = null;
  return [
    (board) => {
      const pr = board.pullRequests.find((candidate) => findStage(candidate) === "review");
      if (!pr) {
        return null;
      }
      approvedNumber = pr.number;
      const next: PullRequest = { ...pr, reviewDecision: "APPROVED", mergeable: "MERGEABLE", parent: null, checks: { passing: 8, failing: [], running: [] } };
      return replace(board, next, eventFor(pr, "moved", { from: "review", to: "approved" }));
    },
    (board) => {
      const pr = board.pullRequests.find((candidate) => candidate.number !== approvedNumber && !candidate.isDraft && findCiState(candidate) === "passing");
      if (!pr) {
        return null;
      }
      const next: PullRequest = { ...pr, checks: { ...pr.checks, failing: ["Unit Tests (shard web-1/3)"] } };
      return replace(board, next, eventFor(pr, "ci-failed"));
    },
    (board) => {
      const pr = board.pullRequests.find((candidate) => candidate.number === approvedNumber);
      if (!pr) {
        return null;
      }
      const event = eventFor(pr, "merged");
      return { board: { ...board, pullRequests: board.pullRequests.filter((candidate) => candidate !== pr), events: [event, ...board.events] }, event };
    },
    (board) => {
      const now = new Date().toISOString();
      const pr: PullRequest = {
        number: DEMO_PR_NUMBER,
        title: "[NA] feat(magic): a brand new spell arrives",
        url: "https://github.com",
        author: viewer,
        authorName: "You",
        isDraft: false,
        createdAt: now,
        updatedAt: now,
        reviewDecision: "REVIEW_REQUIRED",
        mergeable: "MERGEABLE",
        additions: 120,
        deletions: 8,
        changedFiles: 4,
        changes: { code: { additions: 78, deletions: 6 }, tests: { additions: 42, deletions: 2 }, partial: false },
        baseRef: "main",
        headRef: "demo/brand-new-spell",
        parent: null,
        requestedReviewers: [],
        reviews: [],
        checks: { passing: 0, failing: [], running: ["Type Check & Lint"] },
      };
      const event = eventFor(pr, "opened", { to: "review" });
      return { board: { ...board, pullRequests: [pr, ...board.pullRequests], events: [event, ...board.events] }, event };
    },
    (board) => {
      const pr = board.pullRequests.find((candidate) => candidate.number === DEMO_PR_NUMBER);
      if (!pr) {
        return null;
      }
      return replace(board, { ...pr, reviewDecision: "CHANGES_REQUESTED" }, eventFor(pr, "moved", { from: "review", to: "changes" }));
    },
    (board) => {
      const candidates = board.pullRequests.filter(
        (candidate) => !candidate.isDraft && candidate.mergeable !== "CONFLICTING" && candidate.number !== approvedNumber,
      );
      const pr = candidates.find((candidate) => candidate.number !== DEMO_PR_NUMBER) ?? candidates.find((candidate) => candidate.number === DEMO_PR_NUMBER);
      if (!pr) {
        return null;
      }
      return replace(board, { ...pr, mergeable: "CONFLICTING" }, eventFor(pr, "conflict"));
    },
    (board) => {
      const pr = board.pullRequests.find((candidate) => candidate.number === DEMO_PR_NUMBER);
      if (!pr) {
        return null;
      }
      const event = eventFor(pr, "closed", { from: findStage(pr) });
      return { board: { ...board, pullRequests: board.pullRequests.filter((candidate) => candidate !== pr), events: [event, ...board.events] }, event };
    },
  ];
}

// The real board coming back after a demo: PRs the demo removed walk back in, and any it added leave.
export function findRestoreEvents(demoBoard: Board, realBoard: Board): BoardEvent[] {
  const inDemo = new Set(demoBoard.pullRequests.map((pr) => pr.number));
  const inReal = new Set(realBoard.pullRequests.map((pr) => pr.number));
  return [
    ...realBoard.pullRequests.filter((pr) => !inDemo.has(pr.number)).map((pr) => eventFor(pr, "opened", { to: findStage(pr) })),
    ...demoBoard.pullRequests.filter((pr) => !inReal.has(pr.number)).map((pr) => eventFor(pr, "closed", { from: findStage(pr) })),
  ];
}
