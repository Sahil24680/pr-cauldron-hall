import * as THREE from "three";

// The body a cape drapes over, in world space, refreshed by the character every frame: capsules along the torso,
// arms and legs (how game cloth collides), the skirt's outline around the hips, and the way the body faces.
export type Capsule = { start: THREE.Vector3; end: THREE.Vector3; radius: number };
export type CapeBody = {
  capsules: Capsule[];
  hips: THREE.Vector3;
  chest: THREE.Vector3;
  forward: THREE.Vector3;
  floorY: number;
  ready: boolean;
};

export function createCapeBody(capsuleCount: number): CapeBody {
  return {
    capsules: Array.from({ length: capsuleCount }, () => ({ start: new THREE.Vector3(), end: new THREE.Vector3(), radius: 0 })),
    hips: new THREE.Vector3(),
    chest: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, 1),
    floorY: 0,
    ready: false,
  };
}

// The character registers its body against the cape's pin object, so a cape finds what to collide with from the
// anchor it is already given.
const bodies = new WeakMap<THREE.Object3D, CapeBody>();

export function registerCapeBody(anchor: THREE.Object3D, body: CapeBody) {
  bodies.set(anchor, body);
}

export function capeBodyFor(anchor: THREE.Object3D) {
  return bodies.get(anchor) ?? null;
}

const along = new THREE.Vector3();
const toPoint = new THREE.Vector3();
const closest = new THREE.Vector3();

// Moves `point` out to the capsule's surface if it is inside; returns whether it moved.
export function pushOutOfCapsule(point: THREE.Vector3, capsule: Capsule) {
  along.subVectors(capsule.end, capsule.start);
  const lengthSquared = along.lengthSq();
  const share = lengthSquared > 0 ? THREE.MathUtils.clamp(toPoint.subVectors(point, capsule.start).dot(along) / lengthSquared, 0, 1) : 0;
  closest.copy(capsule.start).addScaledVector(along, share);
  toPoint.subVectors(point, closest);
  const distance = toPoint.length();
  if (distance >= capsule.radius || distance < 1e-6) {
    return false;
  }
  point.copy(closest).addScaledVector(toPoint, capsule.radius / distance);
  return true;
}

// Keeps `point` at least `radius` from the vertical axis through `center`, pushing it straight out sideways.
export function pushOutOfColumn(point: THREE.Vector3, center: THREE.Vector3, radius: number) {
  const dx = point.x - center.x;
  const dz = point.z - center.z;
  const distance = Math.hypot(dx, dz);
  if (distance >= radius) {
    return false;
  }
  const scale = distance < 1e-6 ? 0 : radius / distance;
  point.x = center.x + (distance < 1e-6 ? 0 : dx * scale);
  point.z = center.z + (distance < 1e-6 ? -radius : dz * scale);
  return true;
}

// Keeps `point` from passing more than `allowance` in front of the plane through `origin` facing `forward`.
export function keepBehind(point: THREE.Vector3, origin: THREE.Vector3, forward: THREE.Vector3, allowance: number) {
  const ahead = (point.x - origin.x) * forward.x + (point.z - origin.z) * forward.z;
  if (ahead <= allowance) {
    return false;
  }
  point.x -= forward.x * (ahead - allowance);
  point.z -= forward.z * (ahead - allowance);
  return true;
}
