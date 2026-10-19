// Body measurements from the character spec, given in head units (h) and converted to metres here.
// The figure is 6 heads tall; the crown stays at the character's previous height so gameplay is unchanged.
// Axes: +Y up, +Z forward (the way the character faces), +X the character's right; the body is mirror-symmetric.
export const CROWN_HEIGHT = 2.05;
export const H = CROWN_HEIGHT / 6;

const h = (units: number) => units * H;

// 1) Key heights from the ground.
export const EYE_HEIGHT = h(5.5);
export const CHIN_Y = h(5.0);
export const NECK_BASE_Y = h(4.78);
export const SHOULDER_Y = h(4.6);
export const CHEST_Y = h(4.25);
export const WAIST_Y = h(3.6);
export const HIP_Y = h(3.05);
export const WRIST_Y = h(2.75);
export const KNEE_Y = h(1.65);
export const ANKLE_Y = h(0.3);

// 2) Joint pivots (x is the right-hand side; mirror for the left).
export const NECK_PIVOT = { y: h(4.95), z: h(-0.05) };
export const HEAD_PIVOT = { y: h(5.05), z: h(-0.02) };
export const SHOULDER = { x: h(0.85), y: SHOULDER_Y, z: h(-0.05) };
export const ELBOW = { x: h(0.92), y: WAIST_Y, z: h(-0.08) };
export const HIP = { x: h(0.45), y: HIP_Y, z: 0 };
export const KNEE = { x: h(0.42), y: KNEE_Y, z: h(0.04) };
export const ANKLE = { x: h(0.4), y: ANKLE_Y, z: h(-0.02) };

// 3) Segment lengths.
export const UPPER_ARM = h(1.0);
export const FOREARM = h(0.85);
export const HAND_LENGTH = h(0.6);
export const THIGH = h(1.4);
export const SHIN = h(1.35);
export const FOOT_LENGTH = h(0.85);
export const FOOT_HEIGHT = h(0.3);

// 4) Body volumes (half sizes).
export const HEAD = { y: EYE_HEIGHT, halfWidth: h(0.38), halfHeight: h(0.5), halfDepth: h(0.45) };
export const RIBCAGE = { y: CHEST_Y, halfWidth: h(0.62), halfHeight: h(0.55), halfDepth: h(0.4), forwardTilt: (5 * Math.PI) / 180 };
export const WAIST = { halfWidth: h(0.45), halfDepth: h(0.32) };
export const PELVIS = { y: h(3.2), halfWidth: h(0.55), halfHeight: h(0.35), halfDepth: h(0.38) };
export const NECK = { topRadius: h(0.17), baseRadius: h(0.2) };
export const UPPER_ARM_RADIUS = { shoulder: h(0.16), elbow: h(0.12), deltoid: h(0.19), deltoidDrop: h(0.15) };
export const FOREARM_RADIUS = { elbow: h(0.13), wrist: h(0.09) };
export const THIGH_RADIUS = { hip: h(0.28), knee: h(0.17) };
export const CALF_RADIUS = { knee: h(0.17), widest: h(0.19), widestY: h(1.2), bulgeBack: h(-0.04), ankle: h(0.11) };

// 5) Spine and resting posture.
export const SPINE = { chestForward: h(0.05), lowerBackIn: h(0.04) };

// Clothing sits this far outside the body it covers.
export const CLOTH = h(0.07);

export const WIZARD_HEIGHT = CROWN_HEIGHT + 0.7;

// The hat keeps its tall, bent silhouette when scaled to a smaller head.
export const HAT_STRETCH = 1.3;

// Robe radius by height (torso depth already applied); the cloth cape wraps this outline.
export const ROBE_PROFILE: [number, number][] = [
  [0.06, 0.39],
  [0.25, 0.36],
  [0.6, 0.29],
  [0.95, 0.24],
  [WAIST_Y, 0.18],
  [CHEST_Y, 0.2],
  [SHOULDER_Y, 0.22],
];
export const CAPE_TOP_Y = SHOULDER_Y + 0.04;
export const CAPE_LENGTH = SHOULDER_Y - 0.12;
