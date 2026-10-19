import { useGLTF } from "@react-three/drei";
import type { Appearance } from "../../../../shared/cast";
import { CROWN_HEIGHT } from "../wizard/proportions";

// Quaternius Universal Base Characters and Universal Animation Library (CC0), repacked; see public/models/CREDITS.txt.
export type HumanBuild = Appearance["build"];

export const BODY_URLS: Record<HumanBuild, string> = { male: "/models/body-male.glb", female: "/models/body-female.glb" };
export const HAIR_URL = "/models/hair.glb";
export const ANIMATIONS_URL = "/models/animations.glb";
// Boots and pauldrons from Quaternius Modular Character Outfits, Fantasy (CC0), one scene per part and build.
export const OUTFIT_PARTS_URL = "/models/outfit-parts.glb";

// The male model's crown (1.81 m) is scaled to the hall's wizard height so cauldrons, doors and cameras still fit.
const MODEL_CROWN_HEIGHT = 1.81;
export const HUMAN_SCALE = CROWN_HEIGHT / MODEL_CROWN_HEIGHT;

export function preloadHumans() {
  for (const url of [...Object.values(BODY_URLS), HAIR_URL, ANIMATIONS_URL, OUTFIT_PARTS_URL]) {
    useGLTF.preload(url);
  }
}
