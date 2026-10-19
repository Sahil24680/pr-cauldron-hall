import type { Stage } from "../../../shared/board";
import type { SigilMark } from "./artwork";

export const STAGE_SHADES: Record<Stage, { glow: string; deep: string; sigil: SigilMark }> = {
  draft: { glow: "#d6dade", deep: "#33363b", sigil: "open" },
  review: { glow: "#8fb0ff", deep: "#13244d", sigil: "eye" },
  changes: { glow: "#ff8f8f", deep: "#4a0c13", sigil: "broken" },
  approved: { glow: "#8fe6ad", deep: "#0e3b21", sigil: "star" },
};
