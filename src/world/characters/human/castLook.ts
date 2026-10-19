import { useMemo } from "react";
import type { Appearance } from "../../../../shared/cast";
import { type WizardColors, makeWizardLook } from "../wizard/look";

// The colours a wizard wears that come from where they stand (their stage's robe and embroidery), not from the cast.
export type Palette = Pick<WizardColors, "robe" | "trimBand" | "ink" | "motif" | "hat" | "cape" | "capeLining">;

const IRIS = "#5a7fb8";

export function colorsFor(appearance: Appearance, palette: Palette): WizardColors {
  return {
    ...palette,
    skin: appearance.skin,
    hair: appearance.hairColor,
    iris: IRIS,
    beard: appearance.beard ? appearance.beardColor : null,
    wand: appearance.wand,
    hairStyle: "short",
    spectacles: appearance.glasses !== "none",
    archetype: "apprentice",
    outfit: appearance.outfit,
    pattern: appearance.pattern,
    staff: appearance.staff === "none" ? null : appearance.staff,
  };
}

export function useCastLook(appearance: Appearance, palette: Palette, transparent: boolean) {
  return useMemo(() => makeWizardLook(colorsFor(appearance, palette), transparent), [appearance, palette, transparent]);
}
