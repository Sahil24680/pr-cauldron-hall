import { describe, expect, it } from "vitest";
import { CAST_KEYS, DEFAULT_CAST, HAIR_BY_BUILD, fitToBuild, mergeCast } from "./cast";

describe("DEFAULT_CAST", () => {
  it("has a valid character for every cast member", () => {
    expect(Object.keys(DEFAULT_CAST).sort()).toEqual([...CAST_KEYS].sort());
  });
});

describe("mergeCast", () => {
  it("keeps valid saved members", () => {
    const saved = { ...DEFAULT_CAST, draft: { ...DEFAULT_CAST.draft, glasses: "monocle" } };
    expect(mergeCast(saved).draft.glasses).toBe("monocle");
  });

  it("falls back to the built cast for a member that no longer parses, leaving the others", () => {
    const saved = { ...DEFAULT_CAST, review: { ...DEFAULT_CAST.review, hair: "Mohawk" }, approved: { ...DEFAULT_CAST.approved, glasses: "round" } };
    const merged = mergeCast(saved);
    expect(merged.review).toEqual(DEFAULT_CAST.review);
    expect(merged.approved.glasses).toBe("round");
  });

  it("turns accents added after a save off instead of resetting the member", () => {
    const { pauldrons: _dropped, ...olderAccents } = DEFAULT_CAST.player.accents;
    const saved = { player: { ...DEFAULT_CAST.player, glasses: "square", accents: olderAccents } };
    const merged = mergeCast(saved);
    expect(merged.player.glasses).toBe("square");
    expect(merged.player.accents.pauldrons).toBe(false);
  });

  it("returns the built cast for anything that is not a record", () => {
    expect(mergeCast(null)).toEqual(DEFAULT_CAST);
    expect(mergeCast("nonsense")).toEqual(DEFAULT_CAST);
  });
});

describe("fitToBuild", () => {
  it("never gives the female build a beard", () => {
    expect(fitToBuild({ ...DEFAULT_CAST.draft, build: "female", beard: true }).beard).toBe(false);
    expect(fitToBuild({ ...DEFAULT_CAST.review, build: "male", beard: true }).beard).toBe(true);
  });

  it("swaps hair fitted to the other head for its nearest match", () => {
    expect(fitToBuild({ ...DEFAULT_CAST.draft, build: "female", hair: "Buzzed" }).hair).toBe("BuzzedFemale");
    expect(fitToBuild({ ...DEFAULT_CAST.player, build: "male", hair: "Buns" }).hair).toBe("Long");
    expect(fitToBuild({ ...DEFAULT_CAST.player, build: "male", hair: "SimpleParted" }).hair).toBe("SimpleParted");
  });

  it("keeps every built cast member within their build's hair and beard", () => {
    for (const member of Object.values(DEFAULT_CAST)) {
      expect(HAIR_BY_BUILD[member.build]).toContain(member.hair);
      expect(member.beard && member.build === "female").toBe(false);
    }
  });
});
