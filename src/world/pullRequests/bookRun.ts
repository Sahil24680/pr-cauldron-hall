import type { HumanMotion } from "../characters/human";
import { type BookRun, type Point, facingToward } from "../layout";

export type CarrierPose = { at: Point; facing: number; motion: HumanMotion; carrying: boolean };

export const BOOK_CARRY_SPEED = 1.1;
const POUR_SECONDS = 2.4;
const PICKUP_SECONDS = 1.6;

function between(from: Point, to: Point, amount: number): Point {
  return { x: from.x + (to.x - from.x) * amount, z: from.z + (to.z - from.z) * amount };
}

// One round trip: carry a book to the grand cauldron, brew it in, walk back empty handed, take the next book.
export function carrierAt({ pickup, drop }: BookRun, time: number): CarrierPose {
  const walkSeconds = Math.hypot(drop.spot.x - pickup.spot.x, drop.spot.z - pickup.spot.z) / BOOK_CARRY_SPEED;
  let left = time % (walkSeconds * 2 + POUR_SECONDS + PICKUP_SECONDS);
  if (left < walkSeconds) {
    return { at: between(pickup.spot, drop.spot, left / walkSeconds), facing: facingToward(pickup.spot, drop.spot), motion: "walk", carrying: true };
  }
  left -= walkSeconds;
  if (left < POUR_SECONDS) {
    return { at: drop.spot, facing: drop.facing, motion: "brew", carrying: false };
  }
  left -= POUR_SECONDS;
  if (left < walkSeconds) {
    return { at: between(drop.spot, pickup.spot, left / walkSeconds), facing: facingToward(drop.spot, pickup.spot), motion: "walk", carrying: false };
  }
  return { at: pickup.spot, facing: pickup.facing, motion: "idle", carrying: false };
}
