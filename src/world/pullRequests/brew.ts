import type { PullRequest } from "../../../shared/board";
import { type CiState, MAX_ADDED_LINES, findCiState, findStage, isReadyToMerge, isStale } from "../../../shared/stage";
import { STAGE_THEMES } from "../../lib/theme";

export type Brew = { ci: CiState; stale: boolean; ready: boolean; conflicted: boolean; heavy: boolean; stageColor: string };

const CI_URGENCY: CiState[] = ["failing", "running", "passing", "none"];

export function brewOf(pr: PullRequest, now: number): Brew {
  return {
    ci: findCiState(pr),
    stale: isStale(pr, now),
    ready: isReadyToMerge(pr),
    conflicted: pr.mergeable === "CONFLICTING",
    heavy: pr.additions > MAX_ADDED_LINES,
    stageColor: STAGE_THEMES[findStage(pr)].banner,
  };
}

// One brew for a whole stack: the most urgent CI wins, and a single ready or conflicted PR shows on the pot.
export function summariseBrew(pullRequests: PullRequest[], now: number): Brew | null {
  const brews = pullRequests.map((pr) => brewOf(pr, now));
  const first = brews[0];
  if (!first) {
    return null;
  }
  return {
    ci: CI_URGENCY.find((ci) => brews.some((brew) => brew.ci === ci)) ?? "none",
    stale: brews.every((brew) => brew.stale),
    ready: brews.some((brew) => brew.ready),
    conflicted: brews.some((brew) => brew.conflicted),
    heavy: false,
    stageColor: first.stageColor,
  };
}
