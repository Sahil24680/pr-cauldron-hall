import type { RefObject } from "react";
import type * as THREE from "three";
import type { Appearance } from "../../../../shared/cast";
import { ClothCape } from "../cloth/ClothCape";
import type { WizardLook } from "../wizard/look";
import { capeFitFor } from "./capeFit";

// The swinging cloth of a wizard's cape, sized to their outfit and chosen length; the fitted yoke and clasp are part
// of HumanWizard.
export function WizardCape({ anchor, look, appearance }: { anchor: RefObject<THREE.Group | null>; look: WizardLook; appearance: Appearance }) {
  if (appearance.cape === "none") {
    return null;
  }
  return <ClothCape anchor={anchor} material={look.cape} fit={capeFitFor(look.outfit, appearance.cape)} />;
}
