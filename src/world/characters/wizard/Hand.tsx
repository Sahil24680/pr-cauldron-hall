import * as THREE from "three";
import type { WizardLook } from "./look";
import { H, HAND_LENGTH } from "./proportions";

export type Curl = { knuckle: number; middle: number; tip: number; thumb: number };

export const FIST: Curl = { knuckle: 1.3, middle: 1.4, tip: 1.0, thumb: 0.75 };
// At rest the fingers are slightly curled.
export const RELAXED: Curl = { knuckle: 0.25, middle: 0.35, tip: 0.25, thumb: 0.2 };
// The hand is built to the spec's size; kept as a hook for the arm assembly.
export const HAND_SCALE = 1;

// Palm half-size from the spec (width 0.10 h, length 0.18 h, thickness 0.05 h). Palms face the body, so the palm's
// thickness runs along x and its width along z.
const PALM = { halfWidth: 0.1 * H, halfLength: 0.18 * H, halfThickness: 0.05 * H };
const FINGER_LENGTH = 0.42 * H;
// Fingers end where the hand does, so their roots sit inside the bottom of the palm.
export const KNUCKLE_Y = -(HAND_LENGTH - FINGER_LENGTH);
const PALM_CENTER_Y = KNUCKLE_Y + PALM.halfLength - 0.02 * H;
const FINGER_RADIUS = { root: 0.035 * H, tip: 0.028 * H };
const SEGMENT_SHARES = [0.45, 0.3, 0.25];
// Index to little finger: slightly shorter toward the outside, spread across the palm's width.
const FINGERS = [
  { z: PALM.halfWidth * 0.72, length: 1 },
  { z: PALM.halfWidth * 0.24, length: 1.06 },
  { z: -PALM.halfWidth * 0.24, length: 1 },
  { z: -PALM.halfWidth * 0.72, length: 0.84 },
];
const THUMB_OUTWARD = (40 * Math.PI) / 180;
const THUMB_LENGTH = 0.85;

const palm = new THREE.SphereGeometry(1, 16, 12);
const segments = SEGMENT_SHARES.map((share, index) => {
  const radius = THREE.MathUtils.lerp(FINGER_RADIUS.root, FINGER_RADIUS.tip, index / (SEGMENT_SHARES.length - 1));
  return { length: FINGER_LENGTH * share, radius, geometry: new THREE.CapsuleGeometry(radius, Math.max(0.001, FINGER_LENGTH * share - radius * 2), 4, 8) };
});

// A finger is a chain of three joints that curl toward the midline (-side about z).
function Finger({ side, curl, look, length }: { side: number; curl: [number, number, number]; look: WizardLook; length: number }) {
  const [first, second, third] = segments;
  if (!first || !second || !third) {
    return null;
  }
  return (
    <group rotation={[0, 0, -side * curl[0]]} scale={[1, length, 1]}>
      <mesh geometry={first.geometry} material={look.skin} position={[0, -first.length / 2, 0]} />
      <group position={[0, -first.length, 0]} rotation={[0, 0, -side * curl[1]]}>
        <mesh geometry={second.geometry} material={look.skin} position={[0, -second.length / 2, 0]} />
        <group position={[0, -second.length, 0]} rotation={[0, 0, -side * curl[2]]}>
          <mesh geometry={third.geometry} material={look.skin} position={[0, -third.length / 2, 0]} />
        </group>
      </group>
    </group>
  );
}

export function Hand({ side, look, grip }: { side: number; look: WizardLook; grip: Curl }) {
  const fingerCurl: [number, number, number] = [grip.knuckle, grip.middle, grip.tip];
  return (
    <group>
      <mesh geometry={palm} material={look.skin} scale={[PALM.halfThickness, PALM.halfLength, PALM.halfWidth]} position={[0, PALM_CENTER_Y, 0]} castShadow />
      {FINGERS.map(({ z, length }) => (
        <group key={z} position={[-side * PALM.halfThickness * 0.2, KNUCKLE_Y, z]}>
          <Finger side={side} curl={fingerCurl} look={look} length={length} />
        </group>
      ))}
      <group
        position={[-side * PALM.halfThickness * 0.6, PALM_CENTER_Y + PALM.halfLength * 0.2, PALM.halfWidth * 0.95]}
        rotation={[THUMB_OUTWARD, 0, -side * 0.35]}
      >
        <Finger side={side} curl={[grip.thumb, grip.thumb * 0.8, grip.thumb * 0.6]} look={look} length={THUMB_LENGTH} />
      </group>
    </group>
  );
}
