import * as THREE from "three";
import { hex } from "./canvas";
import { type Motif, type RobePattern, linenFabric, robeBodyFabric, robeFabric, satinFabric, stripeFabric } from "./fabric";
import { capeVelvet, jewel, leather, linen, metal, satin, velvet } from "./materials";
import { trimFabric, trimRelief, trimSheen } from "./trimBand";

export type WandStyle = "elder" | "holly" | "ebony" | "vine";
export type HairStyle = "loose" | "ponytail" | "braids" | "bun" | "short";
// Apprentices stand tall in robes or short coats; the elder (the Headmaster) is stooped, bearded and carries a staff.
export type Archetype = "apprentice" | "elder";
export type Outfit = "robe" | "coat" | "longcoat";
export type Staff = "crystal" | "orb";
export type { Motif, RobePattern };

export type WizardColors = {
  robe: string;
  // Contrasting band colour for cuffs, hem, collar and hat band (edged in `ink`).
  trimBand: string;
  // Colour of the embroidered motif and trim edges: gold for most, silver for drafts.
  ink: string;
  motif: Motif;
  pattern: RobePattern;
  hat: string;
  skin: string;
  hair: string;
  iris: string;
  beard: string | null;
  wand: WandStyle;
  hairStyle: HairStyle;
  spectacles: boolean;
  archetype: Archetype;
  outfit: Outfit;
  staff: Staff | null;
  cape?: string;
  // Inside of sleeves, coat skirts and the hat brim; defaults to the trim band colour.
  lining?: string;
  // Inside of the cape; defaults to the lining.
  capeLining?: string;
  // The shirt worn under the robe; defaults to a pale shade of the robe.
  tunic?: string;
};

type Standard = THREE.MeshStandardMaterial;
export type WizardLook = Record<
  | "robe"
  | "robeFolds"
  | "tunic"
  | "lining"
  | "liningInside"
  | "cape"
  | "trim"
  | "gold"
  | "gem"
  | "leather"
  | "hat"
  | "skin"
  | "blush"
  | "lips"
  | "hair"
  | "sclera"
  | "iris"
  | "pupil"
  | "boots"
  | "stockings"
  | "breeches"
  | "wandWood"
  | "wandAccent"
  | "lens",
  Standard
> & {
  beard: Standard | null;
  wandTip: THREE.MeshBasicMaterial;
  wand: WandStyle;
  hairStyle: HairStyle;
  spectacles: boolean;
  archetype: Archetype;
  outfit: Outfit;
  staff: Staff | null;
  // The staff head glows; its colour can change with the wizard's state.
  staffGem: THREE.MeshBasicMaterial;
};

const WAND_STYLES: Record<WandStyle, { wood: string; accent: string; metal: boolean }> = {
  elder: { wood: "#8d7f6c", accent: "#5e5245", metal: false },
  holly: { wood: "#d9c6a0", accent: "#5a3b22", metal: false },
  ebony: { wood: "#1b1714", accent: "#c7ccd2", metal: true },
  vine: { wood: "#6b2f1f", accent: "#3d1a10", metal: false },
};

// Cheeks, nose and ears read warmer than the rest of the face.
const BLUSH = new THREE.Color("#d9776a");
const LIPS = new THREE.Color("#a8483e");
const IVORY = new THREE.Color("#efe6d2");
const TUNIC_PALENESS = 0.42;
const BELT_LEATHER = "#5e3b22";
const BOOT_LEATHER = "#3a2516";

function tunicColor(colors: WizardColors) {
  return colors.tunic ?? hex(new THREE.Color(colors.robe).lerp(IVORY, TUNIC_PALENESS));
}

export function makeWizardLook(colors: WizardColors, transparent: boolean): WizardLook {
  const material = (color: THREE.ColorRepresentation, roughness: number, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent });
  const wand = WAND_STYLES[colors.wand];
  const skin = new THREE.Color(colors.skin);
  const capeColor = colors.cape ?? new THREE.Color(colors.robe).offsetHSL(0, 0, -0.12).getStyle();
  const liningColor = colors.lining ?? colors.trimBand;
  const robeMap = robeFabric(colors.robe, colors.pattern, colors.ink);
  const trim = new THREE.MeshStandardMaterial({
    map: trimFabric(colors.trimBand, colors.ink, colors.pattern),
    normalMap: trimRelief(colors.pattern),
    roughnessMap: trimSheen(colors.pattern),
    metalnessMap: trimSheen(colors.pattern),
    roughness: 1,
    metalness: 1,
    transparent,
  });
  return {
    robe: velvet({ map: robeBodyFabric(colors.robe, colors.pattern, colors.ink, colors.trimBand), tint: colors.robe, transparent }),
    robeFolds: velvet({ map: robeMap, tint: colors.robe, transparent, shaded: true }),
    tunic: linen({ map: linenFabric(tunicColor(colors), [1, 1]), tint: tunicColor(colors), transparent, shaded: true }),
    lining: material(new THREE.Color(colors.robe).multiplyScalar(0.45), 0.9),
    liningInside: satin({ map: satinFabric(liningColor, [3, 2]), tint: liningColor, transparent, side: THREE.BackSide }),
    cape: capeVelvet({ map: robeFabric(capeColor, colors.pattern, colors.ink, [2, 2]), tint: capeColor, transparent }, colors.capeLining ?? liningColor),
    trim,
    gold: metal(colors.ink, 0.28, transparent),
    gem: jewel(new THREE.Color(colors.trimBand).offsetHSL(0, 0.1, 0.12), transparent),
    leather: leather(BELT_LEATHER, [4, 1], transparent),
    hat: velvet({ map: robeFabric(colors.hat, colors.pattern, colors.ink, [3, 2]), tint: colors.hat, transparent, shaded: true }),
    skin: Object.assign(material(skin, 0.6), { vertexColors: true }),
    blush: material(skin.clone().lerp(BLUSH, 0.3), 0.55),
    lips: material(skin.clone().lerp(LIPS, 0.45), 0.45),
    hair: Object.assign(material(colors.hair, 0.6), { vertexColors: true }),
    sclera: material("#f7f3ea", 0.3),
    iris: material(colors.iris, 0.25),
    pupil: material("#0d0b10", 0.2),
    boots: leather(BOOT_LEATHER, [3, 1], transparent),
    stockings: Object.assign(material("#ffffff", 0.7), { map: stripeFabric(colors.ink, colors.robe) }),
    breeches: velvet({
      map: robeFabric(new THREE.Color(colors.robe).offsetHSL(0, 0, -0.06).getStyle(), "plain", colors.ink, [2, 1]),
      tint: colors.robe,
      transparent,
    }),
    lens: Object.assign(material("#bfe3ff", 0.05, 0.1), { opacity: 0.35, transparent: true }),
    beard: colors.beard ? Object.assign(material(colors.beard, 0.7), { vertexColors: true }) : null,
    wandWood: material(wand.wood, 0.55),
    wandAccent: material(wand.accent, wand.metal ? 0.25 : 0.6, wand.metal ? 0.9 : 0),
    wandTip: new THREE.MeshBasicMaterial({ color: "#fff6cf", transparent, toneMapped: false }),
    wand: colors.wand,
    hairStyle: colors.hairStyle,
    spectacles: colors.spectacles,
    archetype: colors.archetype,
    outfit: colors.outfit,
    staff: colors.staff,
    staffGem: new THREE.MeshBasicMaterial({ color: colors.staff === "orb" ? "#8fd3ff" : "#c08cff", transparent, toneMapped: false }),
  };
}
