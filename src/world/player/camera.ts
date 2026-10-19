import * as THREE from "three";
import { EYE_HEIGHT } from "../characters/wizard/proportions";
import { HALL_HALF_WIDTH, type Rect, WALL_HEIGHT } from "../layout";
import { FLY_SPEED, FLY_SPRINT_MULTIPLIER, PLAYER_RADIUS, RUN_SPEED, WALK_SPEED } from "./movement";
import type { Player, ViewMode } from "./player";

export type CameraBox = Rect & { minY: number; maxY: number };
export type HeadBob = { lift: number; sway: number };

export const BASE_FOV: Record<ViewMode, number> = { first: 72, third: 55 };
const SPEED_FOV_WIDENING = 0.12;
// Side-wall pillars stand 0.8 m proud of the wall (inset 0.45 + radius 0.35 at the base); the bookcases between them 0.5 m.
const SIDE_WALL_FURNITURE_DEPTH = 0.8;
// The truss tie beams hang 0.16 m below the top of the walls.
const CEILING_Y = WALL_HEIGHT - 0.16;
// The near plane's corners sit about 0.13 m from the eye at the widest field of view; this keeps them out of walls.
const CAMERA_MARGIN = 0.25;
const FLOOR_CLEARANCE = 0.3;
const BOB = { walkLift: 0.022, sprintLift: 0.042, walkSway: 0.008, sprintSway: 0.014 };

function clamp01(value: number) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

export function playerBounds(bounds: Rect): Rect {
  const sideLimit = HALL_HALF_WIDTH - SIDE_WALL_FURNITURE_DEPTH - PLAYER_RADIUS;
  return { ...bounds, minX: Math.max(bounds.minX, -sideLimit), maxX: Math.min(bounds.maxX, sideLimit) };
}

export function cameraBox(bounds: Rect): CameraBox {
  const sideLimit = HALL_HALF_WIDTH - SIDE_WALL_FURNITURE_DEPTH - CAMERA_MARGIN;
  return { ...bounds, minX: -sideLimit, maxX: sideLimit, minY: FLOOR_CLEARANCE, maxY: CEILING_Y - CAMERA_MARGIN };
}

export function highestFlight() {
  return CEILING_Y - CAMERA_MARGIN - EYE_HEIGHT;
}

export function headBob(player: Player, enabled: boolean): HeadBob {
  if (!enabled || player.flying || player.y > 0) {
    return { lift: 0, sway: 0 };
  }
  const speed = Math.hypot(player.velocityX, player.velocityZ);
  const gait = Math.min(1, speed / WALK_SPEED);
  const sprint = clamp01((speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED));
  return {
    lift: Math.abs(Math.sin(player.stride)) * THREE.MathUtils.lerp(BOB.walkLift, BOB.sprintLift, sprint) * gait,
    sway: Math.sin(player.stride) * THREE.MathUtils.lerp(BOB.walkSway, BOB.sprintSway, sprint) * gait,
  };
}

export function firstPersonEye(player: Player, bob: HeadBob) {
  return new THREE.Vector3(player.x - Math.cos(player.yaw) * bob.sway, player.y + EYE_HEIGHT + bob.lift, player.z + Math.sin(player.yaw) * bob.sway);
}

export function targetFov(mode: ViewMode, player: Player) {
  const cruise = player.flying ? FLY_SPEED : WALK_SPEED;
  const top = player.flying ? FLY_SPEED * FLY_SPRINT_MULTIPLIER : RUN_SPEED;
  const speed = Math.hypot(player.velocityX, player.flying ? player.verticalSpeed : 0, player.velocityZ);
  return BASE_FOV[mode] * (1 + SPEED_FOV_WIDENING * clamp01((speed - cruise) / (top - cruise)));
}
