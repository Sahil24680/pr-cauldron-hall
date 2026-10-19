import * as THREE from "three";
import type { Player, ViewMode } from "./player";

export const RADIANS_PER_PIXEL = 0.0025;

// Third person stops short of looking straight down on the hat or up from under the floor, where the orbit flips.
const PITCH_RANGE: Record<ViewMode, { min: number; max: number }> = {
  first: { min: THREE.MathUtils.degToRad(-89), max: THREE.MathUtils.degToRad(89) },
  third: { min: THREE.MathUtils.degToRad(-70), max: THREE.MathUtils.degToRad(35) },
};

export function clampPitch(pitch: number, mode: ViewMode) {
  const range = PITCH_RANGE[mode];
  return THREE.MathUtils.clamp(pitch, range.min, range.max);
}

export function turnView(player: Player, yawRadians: number, pitchRadians: number, mode: ViewMode) {
  player.yaw = THREE.MathUtils.euclideanModulo(player.yaw + yawRadians, Math.PI * 2);
  player.pitch = clampPitch(player.pitch + pitchRadians, mode);
}

// Travel within this angle of the view counts as heading forward. Swinging the camera behind a strafe or a backpedal
// would turn the travel with it and run the wizard in circles.
export const RECENTER_WITHIN = THREE.MathUtils.degToRad(50);
const RECENTER_RATE = 1.2;
// Caps how fast a held diagonal bends the path: a turn about 10 m in radius at a walk.
const RECENTER_MAX_YAW_RATE = 0.35;
// Only the outermost sliver of the canvas turns the view, where a dragged cursor runs out of room.
const EDGE_ZONE = 0.96;

export function recenterYaw(offset: number, delta: number) {
  if (Math.abs(offset) > RECENTER_WITHIN) {
    return 0;
  }
  const most = RECENTER_MAX_YAW_RATE * delta;
  return THREE.MathUtils.clamp(offset * Math.min(1, delta * RECENTER_RATE), -most, most);
}

// How hard a cursor at `position` (-1 to 1 across the canvas) pushes the view round, from 0 inside to 1 at the edge.
export function edgePush(position: number) {
  const past = Math.abs(position) - EDGE_ZONE;
  return past > 0 ? Math.sign(position) * Math.min(1, past / (1 - EDGE_ZONE)) : 0;
}
