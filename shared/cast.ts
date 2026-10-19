import { z } from "zod";
import committed from "./cast.json";

// The cast: one character per stage, the Headmaster who stands in for crowded stages, and the player's own wizard.
// cast.json is committed: the Appearance menu writes edits back to it, so pushing it shares the characters and a
// static deploy shows them as committed.
export const CAST_KEYS = ["player", "draft", "review", "changes", "approved", "headmaster"] as const;
export type CastKey = (typeof CAST_KEYS)[number];

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i);

// Accents added later default to off, so a cast saved before they existed still loads instead of resetting.
const accent = z.boolean().default(false);
const accentsSchema = z.object({
  belt: accent,
  sash: accent,
  collar: accent,
  hood: accent,
  frontPanel: accent,
  twoToneSleeves: accent,
  pauldrons: accent,
  lapels: accent,
  pendant: accent,
  pouch: accent,
  scrollCase: accent,
});
export type Accents = z.infer<typeof accentsSchema>;
export type Accent = keyof Accents;

export const CAPE_STYLES = ["none", "short", "long"] as const;
export const ROBE_PATTERNS = ["celestial", "runic", "alchemy", "herbal", "damask", "plain"] as const;

export const appearanceSchema = z.object({
  build: z.enum(["male", "female"]),
  hair: z.enum(["Buzzed", "SimpleParted", "Long", "Buns", "BuzzedFemale"]),
  hairColor: hexColor,
  skin: hexColor,
  beard: z.boolean(),
  beardColor: hexColor,
  physique: z.enum(["slender", "average", "broad"]),
  glasses: z.enum(["none", "round", "halfMoon", "square", "monocle"]),
  outfit: z.enum(["robe", "coat", "longcoat"]),
  pattern: z.enum(ROBE_PATTERNS).default("celestial"),
  accents: accentsSchema,
  wand: z.enum(["elder", "holly", "ebony", "vine"]),
  staff: z.enum(["none", "crystal", "orb"]),
  cape: z.enum(CAPE_STYLES).default("long"),
});
export type Appearance = z.infer<typeof appearanceSchema>;

const castSchema = z.object({
  player: appearanceSchema,
  draft: appearanceSchema,
  review: appearanceSchema,
  changes: appearanceSchema,
  approved: appearanceSchema,
  headmaster: appearanceSchema,
});
export type Cast = z.infer<typeof castSchema>;

export const castKeySchema = z.enum(CAST_KEYS);

// Hair meshes are fitted to one head shape each, and beards only grow on the male build.
export const HAIR_BY_BUILD: Record<Appearance["build"], Appearance["hair"][]> = {
  male: ["Buzzed", "SimpleParted", "Long"],
  female: ["Long", "Buns", "BuzzedFemale"],
};
const CROPPED_FOR: Record<Appearance["build"], Appearance["hair"]> = { male: "Buzzed", female: "BuzzedFemale" };
const LONG_HAIR: Appearance["hair"] = "Long";

function hairFor(build: Appearance["build"], hair: Appearance["hair"]) {
  if (HAIR_BY_BUILD[build].includes(hair)) {
    return hair;
  }
  return hair === "Buzzed" || hair === "BuzzedFemale" ? CROPPED_FOR[build] : LONG_HAIR;
}

export function fitToBuild(appearance: Appearance): Appearance {
  return { ...appearance, hair: hairFor(appearance.build, appearance.hair), beard: appearance.build === "male" && appearance.beard };
}
const parsedCast = castSchema.parse(committed);
export const DEFAULT_CAST: Cast = {
  player: fitToBuild(parsedCast.player),
  draft: fitToBuild(parsedCast.draft),
  review: fitToBuild(parsedCast.review),
  changes: fitToBuild(parsedCast.changes),
  approved: fitToBuild(parsedCast.approved),
  headmaster: fitToBuild(parsedCast.headmaster),
};

// Entries that no longer match the schema (a hand edit, a merge gone wrong) fall back to that member as built.
export function mergeCast(saved: unknown): Cast {
  const record = z.record(z.string(), z.unknown()).safeParse(saved);
  const member = (key: CastKey) => {
    const parsed = appearanceSchema.safeParse(record.success ? record.data[key] : undefined);
    return parsed.success ? fitToBuild(parsed.data) : DEFAULT_CAST[key];
  };
  return {
    player: member("player"),
    draft: member("draft"),
    review: member("review"),
    changes: member("changes"),
    approved: member("approved"),
    headmaster: member("headmaster"),
  };
}
