import * as THREE from "three";
import type { Rect } from "../layout";
import type { CameraBox } from "./camera";

export const PIVOT_HEIGHT = 1.7;
export const SHOULDER_OFFSET = 0.45;
// A sphere this size around the camera keeps the near plane's corners out of whatever it backs into.
const CAMERA_RADIUS = 0.25;
const CAULDRON_TOP = 1.2;

const ray = new THREE.Ray();
const hit = new THREE.Vector3();
const padded = new THREE.Box3();

export function solidsFromFootprints(footprints: Rect[]) {
  return footprints.map((rect) => new THREE.Box3(new THREE.Vector3(rect.minX, 0, rect.minZ), new THREE.Vector3(rect.maxX, CAULDRON_TOP, rect.maxZ)));
}

export function viewForward(yaw: number, pitch: number) {
  return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
}

export function viewRight(yaw: number) {
  return new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
}

function roomAlong(from: number, direction: number, min: number, max: number) {
  if (direction > 0) {
    return (max - from) / direction;
  }
  if (direction < 0) {
    return (min - from) / direction;
  }
  return Number.POSITIVE_INFINITY;
}

// How far a camera-sized sphere can travel from `origin` along the unit `direction` before it meets the hall or a solid.
export function clearDistance(origin: THREE.Vector3, direction: THREE.Vector3, wanted: number, hall: CameraBox, solids: THREE.Box3[]) {
  let limit = Math.min(
    wanted,
    roomAlong(origin.x, direction.x, hall.minX, hall.maxX),
    roomAlong(origin.y, direction.y, hall.minY, hall.maxY),
    roomAlong(origin.z, direction.z, hall.minZ, hall.maxZ),
  );
  ray.set(origin, direction);
  for (const solid of solids) {
    padded.copy(solid).expandByScalar(CAMERA_RADIUS);
    if (!padded.containsPoint(origin) && ray.intersectBox(padded, hit)) {
      limit = Math.min(limit, origin.distanceTo(hit));
    }
  }
  return Math.max(0, limit);
}

// The camera hangs behind a point just right of the head, so the wizard sits left of centre and the path ahead stays clear.
// A negative offset hangs it over the left shoulder instead.
export function shoulderPivot(head: THREE.Vector3, yaw: number, hall: CameraBox, solids: THREE.Box3[], offset = SHOULDER_OFFSET) {
  const side = viewRight(yaw).multiplyScalar(Math.sign(offset));
  return head.clone().addScaledVector(side, clearDistance(head, side, Math.abs(offset), hall, solids));
}
