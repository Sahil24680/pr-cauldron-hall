import type { Stage } from "../../../../shared/board";
import type { CastKey } from "../../../../shared/cast";
import { darken } from "../../../lib/color";
import { STAGE_THEMES } from "../../../lib/theme";
import type { Palette } from "./castLook";

const GOLD_INK = "#e9c46a";
const SILVER_INK = "#d8dde6";
const CRIMSON_BAND = "#9c1c28";
const HAT_SHADE = 0.8;

// Each stage wears its banner colour with its own embroidered motif, a band that contrasts with the robe, and a cape in
// a contrasting colour so it reads as its own garment rather than melting into the robe.
const STAGE_TRIM: Record<Stage, Pick<Palette, "motif" | "ink" | "trimBand" | "cape">> = {
  draft: { motif: "moons", ink: SILVER_INK, trimBand: "#33405e", cape: "#3d2a52" },
  review: { motif: "stars", ink: GOLD_INK, trimBand: CRIMSON_BAND, cape: "#7a1f2b" },
  changes: { motif: "runes", ink: GOLD_INK, trimBand: "#22305e", cape: "#1c2b4f" },
  approved: { motif: "leaves", ink: GOLD_INK, trimBand: CRIMSON_BAND, cape: "#6a2440" },
};
const HEADMASTER_CAPE = "#3a1f5c";

export function stagePalette(stage: Stage): Palette {
  const robe = STAGE_THEMES[stage].banner;
  return { robe, hat: darken(robe, HAT_SHADE), ...STAGE_TRIM[stage] };
}

// The Headmaster dresses in the stage's colour but always in moons and gold, the same in every stage.
export function headmasterPalette(stage: Stage): Palette {
  const robe = STAGE_THEMES[stage].banner;
  return { robe, hat: darken(robe, HAT_SHADE), motif: "moons", ink: GOLD_INK, trimBand: stage === "changes" ? "#22305e" : CRIMSON_BAND, cape: HEADMASTER_CAPE };
}

// The player's own wizard: a gold coat with crimson bands, and a crimson cape lined in gold.
export const PLAYER_PALETTE: Palette = {
  robe: "#c8952a",
  trimBand: "#7a1f2b",
  ink: "#f0d27a",
  motif: "stars",
  hat: "#7a1f2b",
  cape: "#6b1620",
  capeLining: "#b8862a",
};

const STONE = { robe: "#8d8f93", hat: "#77797d", trim: "#9a9ca0", ink: "#a6a8ab" };

// Stale PRs turn their wizard to stone.
export const STONE_PALETTE: Palette = { robe: STONE.robe, hat: STONE.hat, trimBand: STONE.trim, ink: STONE.ink, motif: "moons" };

export function paletteFor(key: CastKey): Palette {
  if (key === "player") {
    return PLAYER_PALETTE;
  }
  if (key === "headmaster") {
    return headmasterPalette("review");
  }
  return stagePalette(key);
}
