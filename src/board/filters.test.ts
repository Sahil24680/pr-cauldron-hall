import { describe, expect, it } from "vitest";
import { makePullRequest } from "../../test/factories";
import { type Filters, isFiltering, matchesFilters, parseSavedFilters } from "./filters";

const NOW = new Date("2026-10-19T00:00:00.000Z").getTime();
const none: Filters = { query: "", people: [], flag: null };

describe("matchesFilters", () => {
  it("matches everything with no filters", () => {
    expect(isFiltering(none)).toBe(false);
    expect(matchesFilters(makePullRequest(), none, NOW)).toBe(true);
  });

  it("filters by author", () => {
    expect(matchesFilters(makePullRequest({ author: "a" }), { ...none, people: ["a"] }, NOW)).toBe(true);
    expect(matchesFilters(makePullRequest({ author: "b" }), { ...none, people: ["a"] }, NOW)).toBe(false);
  });

  it("matches every search word against number, title, branch and author, ignoring a leading #", () => {
    const pr = makePullRequest({ number: 2131, title: "feat(potions): brew an elixir", headRef: "spell-1234-elixir" });
    expect(matchesFilters(pr, { ...none, query: "#2131" }, NOW)).toBe(true);
    expect(matchesFilters(pr, { ...none, query: "elixir 1234" }, NOW)).toBe(true);
    expect(matchesFilters(pr, { ...none, query: "elixir nope" }, NOW)).toBe(false);
  });

  it("filters by a flag such as a failing build", () => {
    const red = makePullRequest({ checks: { passing: 1, failing: ["lint"], running: [] } });
    expect(matchesFilters(red, { ...none, flag: "cursed" }, NOW)).toBe(true);
    expect(matchesFilters(makePullRequest(), { ...none, flag: "cursed" }, NOW)).toBe(false);
  });
});

describe("parseSavedFilters", () => {
  it("restores saved people and flag but never the search text", () => {
    expect(parseSavedFilters({ query: "old", people: ["ana"], flag: "heavy" })).toEqual({ query: "", people: ["ana"], flag: "heavy" });
  });

  it("drops fields that no longer fit", () => {
    expect(parseSavedFilters({ people: "ana", flag: "unknown" })).toEqual(none);
    expect(parseSavedFilters(null)).toEqual(none);
  });
});
