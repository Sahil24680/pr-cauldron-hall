import type { PullRequest, Stage } from "./board";

export type CiState = "failing" | "running" | "passing" | "none";

export const MAX_ADDED_LINES = 500;
export const STALE_DAYS = 7;
const DAY_MS = 86_400_000;

export function findStage(pr: PullRequest): Stage {
  if (pr.isDraft) {
    return "draft";
  }
  if (pr.reviewDecision === "CHANGES_REQUESTED") {
    return "changes";
  }
  if (pr.reviewDecision === "APPROVED") {
    return "approved";
  }
  return "review";
}

export function findCiState(pr: PullRequest): CiState {
  if (pr.checks.failing.length > 0) {
    return "failing";
  }
  if (pr.checks.running.length > 0) {
    return "running";
  }
  if (pr.checks.passing > 0) {
    return "passing";
  }
  return "none";
}

export function isReadyToMerge(pr: PullRequest) {
  return findStage(pr) === "approved" && findCiState(pr) === "passing" && pr.mergeable !== "CONFLICTING" && pr.parent === null;
}

export function daysSinceUpdate(pr: PullRequest, now: number) {
  return (now - new Date(pr.updatedAt).getTime()) / DAY_MS;
}

export function isStale(pr: PullRequest, now: number) {
  return daysSinceUpdate(pr, now) > STALE_DAYS;
}
