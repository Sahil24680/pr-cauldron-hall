import { useEffect, useState } from "react";
import type { PullRequest } from "../../shared/board";
import { MAX_ADDED_LINES, findCiState, isReadyToMerge, isStale } from "../../shared/stage";

export type FlagId = "ready" | "cursed" | "splinched" | "petrified" | "heavy";
export type Filters = { query: string; people: string[]; flag: FlagId | null };

export const FLAGS: { id: FlagId; label: string; hint: string; test: (pr: PullRequest, now: number) => boolean }[] = [
  { id: "ready", label: "Ready to fly", hint: "Approved, green, no conflict", test: (pr) => isReadyToMerge(pr) },
  { id: "cursed", label: "Cursed CI", hint: "A check is failing", test: (pr) => findCiState(pr) === "failing" },
  { id: "splinched", label: "Splinched", hint: "Merge conflict", test: (pr) => pr.mergeable === "CONFLICTING" },
  { id: "petrified", label: "Petrified", hint: "No update in 7 days", test: (pr, now) => isStale(pr, now) },
  { id: "heavy", label: "Heavy tomes", hint: `Over ${MAX_ADDED_LINES} added lines`, test: (pr) => pr.additions > MAX_ADDED_LINES },
];

const STORAGE_KEY = "pr-board-filters";
const EMPTY_FILTERS: Filters = { query: "", people: [], flag: null };

function loadFilters(): Filters {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...EMPTY_FILTERS, ...JSON.parse(saved), query: "" } : EMPTY_FILTERS;
  } catch {
    return EMPTY_FILTERS;
  }
}

export function useFilters() {
  const [filters, setFilters] = useState<Filters>(loadFilters);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // Private windows refuse storage; filters then last for the visit only.
    }
  }, [filters]);
  return [filters, setFilters] as const;
}

export function isFiltering(filters: Filters) {
  return filters.query !== "" || filters.people.length > 0 || filters.flag !== null;
}

export function matchesFilters(pr: PullRequest, filters: Filters, now: number) {
  if (filters.people.length > 0 && !filters.people.includes(pr.author)) {
    return false;
  }
  const flag = FLAGS.find((candidate) => candidate.id === filters.flag);
  if (flag && !flag.test(pr, now)) {
    return false;
  }
  if (filters.query) {
    const haystack = `${pr.number} ${pr.title} ${pr.headRef} ${pr.author} ${pr.authorName}`.toLowerCase();
    return filters.query
      .toLowerCase()
      .split(/\s+/)
      .every((word) => haystack.includes(word.replace(/^#/, "")));
  }
  return true;
}
