import type { Stage } from "../../shared/board";

export type StageTheme = { id: Stage; name: string; plain: string; banner: string; trim: string };

export const STAGE_ORDER: Stage[] = ["draft", "review", "changes", "approved"];

export const STAGE_THEMES: Record<Stage, StageTheme> = {
  draft: { id: "draft", name: "The Cauldron", plain: "Drafts", banner: "#6b6f76", trim: "#c9ced2" },
  review: { id: "review", name: "The Sorting", plain: "Waiting on review", banner: "#24448f", trim: "#c08f4c" },
  changes: { id: "changes", name: "Detention", plain: "Changes requested", banner: "#9c1c28", trim: "#e0ad45" },
  approved: { id: "approved", name: "Mischief Managed", plain: "Approved", banner: "#1f7a45", trim: "#e0c66a" },
};

export function hashOf(value: number | string) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  return hash;
}
