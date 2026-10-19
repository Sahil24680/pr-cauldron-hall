export const WALK_SPEED = 3.6;
export const RUN_SPEED = 7;
export const FLY_SPEED = 7.5;
export const FLY_SPRINT_MULTIPLIER = 2.2;
export const PLAYER_RADIUS = 0.32;

// People step faster when they speed up but mostly lengthen the stride: about 1.05 cycles a second at a walk, 1.5 at a sprint.
const CADENCE_AT_REST = 0.55;
const CADENCE_PER_SPEED = 0.135;
const STANDING_SPEED = 0.05;

export function strideRate(speed: number) {
  return speed < STANDING_SPEED ? 0 : Math.PI * 2 * (CADENCE_AT_REST + CADENCE_PER_SPEED * speed);
}

export function shortestTurn(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function turnToward(current: number, target: number, share: number) {
  return current + shortestTurn(current, target) * Math.min(1, share);
}

// Ground direction for the held keys, relative to a view that faces `yaw`; null when no key steers.
// Where a third-person wizard turns to face while moving: toward travel, except when backing up (S held), where it
// keeps facing away from the camera and backpedals.
export function facingForTravel(yaw: number, forward: number, strafe: number) {
  const travel = travelDirection(yaw, forward, strafe);
  if (!travel) {
    return null;
  }
  return forward < 0 ? Math.atan2(-travel.x, -travel.z) : Math.atan2(travel.x, travel.z);
}

export function travelDirection(yaw: number, forward: number, strafe: number) {
  const x = Math.sin(yaw) * forward - Math.cos(yaw) * strafe;
  const z = Math.cos(yaw) * forward + Math.sin(yaw) * strafe;
  const length = Math.hypot(x, z);
  return length > 0 ? { x: x / length, z: z / length } : null;
}
