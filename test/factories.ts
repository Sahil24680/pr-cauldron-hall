import type { PullRequest } from "../shared/board";

export function makePullRequest(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 1,
    title: "[NA] feat(magic): add a spell",
    url: "https://github.com/example/repo/pull/1",
    author: "wizard",
    authorName: "Wizard",
    isDraft: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-18T00:00:00.000Z",
    reviewDecision: "REVIEW_REQUIRED",
    mergeable: "MERGEABLE",
    additions: 10,
    deletions: 2,
    changedFiles: 1,
    changes: { code: { additions: 10, deletions: 2 }, tests: { additions: 0, deletions: 0 }, partial: false },
    baseRef: "main",
    headRef: "feature/spell",
    parent: null,
    requestedReviewers: [],
    reviews: [],
    checks: { passing: 5, failing: [], running: [] },
    ...overrides,
  };
}
