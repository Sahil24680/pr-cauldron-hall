export type ScreenPoint = { x: number; y: number };
export type LabelSize = { width: number; height: number };
export type SafeArea = { left: number; top: number; right: number; bottom: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Centers the label on its anchor, slid back inside the safe area; null hides it once the anchor itself leaves the area.
export function placeLabel(anchor: ScreenPoint, size: LabelSize, area: SafeArea) {
  if (anchor.x < area.left || anchor.x > area.right || anchor.y < area.top || anchor.y > area.bottom) {
    return null;
  }
  return {
    left: clamp(anchor.x - size.width / 2, area.left, area.right - size.width),
    top: clamp(anchor.y - size.height / 2, area.top, area.bottom - size.height),
  };
}
