import { describe, expect, it } from "vitest";
import { DEFAULT_CAST } from "../../../../shared/cast";
import { colorsFor } from "./castLook";
import { PLAYER_PALETTE, paletteFor, stagePalette } from "./palettes";

describe("colorsFor", () => {
  it("dresses a cast member in their stage's palette", () => {
    const colors = colorsFor(DEFAULT_CAST.review, stagePalette("review"));
    expect(colors.robe).toBe(stagePalette("review").robe);
    expect(colors.skin).toBe(DEFAULT_CAST.review.skin);
    expect(colors.outfit).toBe(DEFAULT_CAST.review.outfit);
  });

  it("turns 'none' choices into absent pieces", () => {
    const colors = colorsFor({ ...DEFAULT_CAST.draft, staff: "none", beard: false, glasses: "none" }, stagePalette("draft"));
    expect(colors.staff).toBeNull();
    expect(colors.beard).toBeNull();
    expect(colors.spectacles).toBe(false);
  });
});

describe("paletteFor", () => {
  it("gives the player their own colours and each stage its banner", () => {
    expect(paletteFor("player")).toBe(PLAYER_PALETTE);
    expect(paletteFor("approved")).toEqual(stagePalette("approved"));
  });
});
