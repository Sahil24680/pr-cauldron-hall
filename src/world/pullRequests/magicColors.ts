import type { CiState } from "../../../shared/stage";

export const MAGIC_COLORS: Record<CiState, string> = { failing: "#ff4b3a", running: "#b48cff", passing: "#5ce08a", none: "#8fa3b8" };
