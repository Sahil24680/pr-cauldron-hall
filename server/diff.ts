import { randomUUID } from "node:crypto";
import type { BoardEvent, BoardEventKind, PullRequest, Stage } from "../shared/board";
import { findCiState, findStage } from "../shared/stage";
import type { ClosedOutcome } from "./github";

type Move = { from?: Stage; to?: Stage };

export function diffPullRequests(previous: PullRequest[], next: PullRequest[], outcomes: Map<number, ClosedOutcome>, at: string) {
  const events: BoardEvent[] = [];
  const record = (pr: PullRequest, kind: BoardEventKind, move: Move = {}) => {
    events.push({ id: randomUUID(), at, kind, number: pr.number, title: pr.title, author: pr.author, authorName: pr.authorName, ...move });
  };
  const previousByNumber = new Map(previous.map((pr) => [pr.number, pr]));
  const stillOpen = new Set(next.map((pr) => pr.number));

  for (const pr of next) {
    const before = previousByNumber.get(pr.number);
    if (!before) {
      record(pr, "opened", { to: findStage(pr) });
      continue;
    }
    const from = findStage(before);
    const to = findStage(pr);
    if (from !== to) {
      record(pr, "moved", { from, to });
    }
    const ciBefore = findCiState(before);
    const ciNow = findCiState(pr);
    if (ciNow === "failing" && ciBefore !== "failing") {
      record(pr, "ci-failed");
    }
    if (ciNow === "passing" && ciBefore === "failing") {
      record(pr, "ci-passed");
    }
    if (pr.mergeable === "CONFLICTING" && before.mergeable !== "CONFLICTING") {
      record(pr, "conflict");
    }
  }

  for (const pr of previous) {
    if (!stillOpen.has(pr.number)) {
      record(pr, outcomes.get(pr.number) ?? "closed");
    }
  }
  return events;
}

// GitHub reports UNKNOWN while it recomputes mergeability, so a PR flickers MERGEABLE, UNKNOWN, MERGEABLE between polls.
export function keepKnownMergeable(pr: PullRequest, before: PullRequest | undefined): PullRequest {
  if (pr.mergeable === "UNKNOWN" && before) {
    return { ...pr, mergeable: before.mergeable };
  }
  return pr;
}
