export const SMOKE_RISE = 2.1;
const SMOKE_FADE_IN = 0.06;
const SMOKE_SIZE = { start: 0.4, growth: 0.95 };

// One puff over its life: it slows as it rises, swells, and thins out to nothing at the top.
export function smokePuffAt(progress: number) {
  return {
    rise: SMOKE_RISE * (1 - (1 - progress) ** 1.3),
    size: SMOKE_SIZE.start + progress * SMOKE_SIZE.growth,
    opacity: Math.min(1, progress / SMOKE_FADE_IN) * (1 - progress),
  };
}

export const BUBBLE_POP_AT = 0.8;
const BUBBLE_DEPTH = { start: -0.04, end: 0.03 };

// One bubble over its life: it swells up through the brew surface, then pops, leaving a brief flash where it was.
export function bubbleAt(progress: number) {
  if (progress < BUBBLE_POP_AT) {
    const grown = progress / BUBBLE_POP_AT;
    return { lift: BUBBLE_DEPTH.start + grown * (BUBBLE_DEPTH.end - BUBBLE_DEPTH.start), size: 0.3 + grown * 0.7, flash: 0 };
  }
  const popped = (progress - BUBBLE_POP_AT) / (1 - BUBBLE_POP_AT);
  return { lift: BUBBLE_DEPTH.end, size: 0, flash: 1 - popped };
}
