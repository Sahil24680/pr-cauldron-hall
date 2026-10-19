import { type Accent, type Appearance, CAPE_STYLES, CAST_KEYS, type CastKey, HAIR_BY_BUILD, ROBE_PATTERNS, appearanceSchema } from "../../shared/cast";
import { STAGE_THEMES } from "../lib/theme";

export type Option<T extends string> = { id: T; label: string };
export type Swatch = { hex: string; name: string };

function optionsOf<T extends string>(ids: readonly T[], labels: Record<T, string>): Option<T>[] {
  return ids.map((id) => ({ id, label: labels[id] }));
}

const fields = appearanceSchema.shape;

export const CAST_OPTIONS = optionsOf<CastKey>(CAST_KEYS, {
  player: "You",
  draft: "Draft",
  review: "Review",
  changes: "Changes",
  approved: "Approved",
  headmaster: "Headmaster",
});

export const CAST_CARD_COLORS: Record<CastKey, string> = {
  player: "#9c7426",
  draft: STAGE_THEMES.draft.banner,
  review: STAGE_THEMES.review.banner,
  changes: STAGE_THEMES.changes.banner,
  approved: STAGE_THEMES.approved.banner,
  headmaster: "#5b3f8f",
};

export const BODY_OPTIONS = optionsOf<Appearance["build"]>(fields.build.options, { male: "Male", female: "Female" });

export const PHYSIQUE_OPTIONS = optionsOf<Appearance["physique"]>(fields.physique.options, { slender: "Slender", average: "Average", broad: "Broad" });

const HAIR_LABELS: Record<Appearance["hair"], string> = {
  Buzzed: "Cropped",
  SimpleParted: "Parted",
  Long: "Long",
  Buns: "Buns",
  BuzzedFemale: "Cropped",
};

export const HAIR_OPTIONS_BY_BUILD: Record<Appearance["build"], Option<Appearance["hair"]>[]> = {
  male: optionsOf(HAIR_BY_BUILD.male, HAIR_LABELS),
  female: optionsOf(HAIR_BY_BUILD.female, HAIR_LABELS),
};

export const GLASSES_OPTIONS = optionsOf<Appearance["glasses"]>(fields.glasses.options, {
  none: "None",
  round: "Round",
  halfMoon: "Half-moon",
  square: "Square",
  monocle: "Monocle",
});

export const OUTFIT_OPTIONS = optionsOf<Appearance["outfit"]>(fields.outfit.options, { robe: "Robe", coat: "Coat", longcoat: "Long coat" });

export const PATTERN_OPTIONS = optionsOf<Appearance["pattern"]>(ROBE_PATTERNS, {
  celestial: "Celestial",
  runic: "Runic",
  alchemy: "Alchemy",
  herbal: "Herbal",
  damask: "Damask",
  plain: "Plain",
});

export const ACCENT_OPTIONS = optionsOf<Accent>(fields.accents.keyof().options, {
  belt: "Belt",
  sash: "Sash",
  collar: "Collar",
  hood: "Hood",
  frontPanel: "Front panel",
  twoToneSleeves: "Two-tone sleeves",
  pauldrons: "Pauldrons",
  lapels: "Lapels",
  pendant: "Pendant",
  pouch: "Pouch",
  scrollCase: "Scroll case",
});

export const WAND_OPTIONS = optionsOf<Appearance["wand"]>(fields.wand.options, { elder: "Elder", holly: "Holly", ebony: "Ebony", vine: "Vine" });

export const CAPE_OPTIONS = optionsOf<Appearance["cape"]>(CAPE_STYLES, { none: "None", short: "Short", long: "Long" });

export const STAFF_OPTIONS = optionsOf<Appearance["staff"]>(fields.staff.options, { none: "None", crystal: "Crystal", orb: "Orb" });

export const HAIR_SWATCHES: Swatch[] = [
  { hex: "#1f1f24", name: "Black" },
  { hex: "#3b2a20", name: "Dark brown" },
  { hex: "#6b4226", name: "Brown" },
  { hex: "#a8743c", name: "Auburn" },
  { hex: "#d8b86a", name: "Blond" },
  { hex: "#c9c9cf", name: "Silver" },
];

export const SKIN_SWATCHES: Swatch[] = [
  { hex: "#f6d5bd", name: "Fair" },
  { hex: "#f1c7a5", name: "Light" },
  { hex: "#e0ac84", name: "Medium" },
  { hex: "#c68b5e", name: "Tan" },
];
