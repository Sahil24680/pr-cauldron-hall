import type { Appearance } from "../../../../shared/cast";
import type { CapeFit } from "../cloth/ClothCape";
import type { Outfit } from "../wizard/look";
import { HUMAN_SCALE } from "./assets";

type HangingCape = Exclude<Appearance["cape"], "none">;

// Measured from the male model in bind pose (model metres, scaled to the hall below). The cloth hangs from across the
// shoulder blades, just outside the fitted yoke so the two read as one garment, and drapes over the back of the tunic,
// then the skirt, then the legs below a coat's hem. The profile is the rest shape only; the bones' capsules do the
// colliding.
// The yoke's back surface sits about 0.146 m behind the spine at the shoulder blades; the pinned edge rides about
// 2.5 cm outside it so the two never share a surface and flicker.
const SHOULDER_TOP_Y = 1.45;
const BACK = { shoulders: 0.135, upperBack: 0.15, waist: 0.19, hip: 0.27, legs: 0.14 };
const BODY_Y = { chest: 1.24, waist: 1.05, hip: 0.92 };
const HEM: Record<Outfit, { y: number; back: number }> = {
  robe: { y: 0.07, back: 0.35 },
  coat: { y: 0.5, back: 0.28 },
  longcoat: { y: 0.27, back: 0.32 },
};
const FLOOR_CLEARANCE = 0.12;
// A short cape ends at the waist, above where the skirt flares over the hips.
const SHORT_HEM_Y = 1.06;

function scaled(points: [number, number][]): [number, number][] {
  return points.map(([y, radius]) => [y * HUMAN_SCALE, radius * HUMAN_SCALE]);
}

function fitFor(outfit: Outfit, style: HangingCape): CapeFit {
  const hem = HEM[outfit];
  const belowHem: [number, number][] =
    hem.y > 0.1
      ? [
          [0.05, BACK.legs],
          [hem.y - 0.02, BACK.legs],
        ]
      : [];
  const topY = SHOULDER_TOP_Y * HUMAN_SCALE;
  const bottomY = style === "short" ? SHORT_HEM_Y * HUMAN_SCALE : FLOOR_CLEARANCE;
  return {
    topY,
    length: topY - bottomY,
    skirtTopY: BODY_Y.waist * HUMAN_SCALE,
    profile: scaled([
      ...belowHem,
      [hem.y, hem.back],
      [BODY_Y.hip, BACK.hip],
      [BODY_Y.waist, BACK.waist],
      [BODY_Y.chest, BACK.upperBack],
      [SHOULDER_TOP_Y, BACK.shoulders],
    ]),
  };
}

const OUTFITS: Outfit[] = ["robe", "coat", "longcoat"];
// One fit object per outfit and length, so capes keep their cloth state across renders.
const FITS = new Map(OUTFITS.flatMap((outfit) => (["short", "long"] as const).map((style) => [`${outfit}:${style}`, fitFor(outfit, style)] as const)));

export function capeFitFor(outfit: Outfit, style: HangingCape = "long") {
  return FITS.get(`${outfit}:${style}`) ?? fitFor(outfit, style);
}
