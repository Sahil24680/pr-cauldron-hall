import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeParts, tube } from "../wizard/clothShapes";
import type { BodyLandmarks } from "./landmarks";
import { SKIRT_WAIST } from "./skirt";

// Shapes in the bind pose (model metres, +Z forward). Chest heights are a fraction t of the way from chestY (0) to
// neckBaseY (1), which lines both builds up. Measured on the tunic shell at physique bulk 0: how far forward its
// front stands near the centre line, taking the larger of the two builds (the female bust included) so nothing
// worn on it sinks in.
const TUNIC_FRONT: readonly (readonly [number, number])[] = [
  [-1.0, 0.109],
  [-0.6, 0.121],
  [-0.3, 0.121],
  [0, 0.124],
  [0.25, 0.133],
  [0.4, 0.146],
  [0.55, 0.144],
  [0.7, 0.132],
  [0.85, 0.119],
  [1.0, 0.094],
];
// The chest curves back away from the centre line: about 6 mm at 8 cm out and 14 mm at 12 cm.
const CHEST_CURVE = 1.0;
// Mirrors skirt.ts: the skirt widens from its waist radius to this at the hip joint.
const SKIRT_HIP_RADIUS = 0.25;

const PENDANT = { at: 0.45, chainFrom: { t: 0.95, x: 0.062 }, sag: 0.025, standOff: 0.006, chain: 0.0022 };
// Hip pieces stay near the front, inside the path the hands swing through when walking.
const POUCH = { angle: -0.42, below: 0.1, standOff: 0.02 };
const SCROLL_CASE = { angle: 0.45, below: 0.13, standOff: 0.026, lean: -0.3, length: 0.15, radius: 0.018 };

function frontAt(t: number) {
  const index = TUNIC_FRONT.findIndex(([at]) => at >= t);
  const upper = TUNIC_FRONT[Math.max(index, 1)] ?? [1, 0];
  const lower = TUNIC_FRONT[Math.max(index, 1) - 1] ?? upper;
  return THREE.MathUtils.lerp(lower[1], upper[1], THREE.MathUtils.clamp((t - lower[0]) / (upper[0] - lower[0]), 0, 1));
}

// A point standing `standOff` in front of the tunic at chest fraction t, `x` from the centre line.
function onChest(landmarks: BodyLandmarks, bulk: number, t: number, x: number, standOff: number) {
  const y = THREE.MathUtils.lerp(landmarks.chestY, landmarks.neckBaseY, t);
  return new THREE.Vector3(x, y, frontAt(t) - CHEST_CURVE * x * x + bulk + standOff);
}

function jewel() {
  return {
    setting: mergeParts([new THREE.CylinderGeometry(0.02, 0.02, 0.006, 20).rotateX(Math.PI / 2), new THREE.TorusGeometry(0.02, 0.003, 6, 20)]),
    stone: new THREE.OctahedronGeometry(0.013, 0).scale(1, 1.3, 0.6).translate(0, 0, 0.006),
  };
}

// A jewel on a chain that hangs from either side of the neck and dips onto the chest.
function pendant(landmarks: BodyLandmarks, bulk: number) {
  const chain = ([-1, 1] as const).map((side) =>
    tube(
      Array.from({ length: 13 }, (_, step) => {
        const along = step / 12;
        const t = THREE.MathUtils.lerp(PENDANT.chainFrom.t, PENDANT.at + 0.08, along) - Math.sin(along * Math.PI) * PENDANT.sag;
        return onChest(landmarks, bulk, t, side * PENDANT.chainFrom.x * (1 - along), PENDANT.standOff);
      }),
      PENDANT.chain,
      4,
      false,
    ),
  );
  const at = onChest(landmarks, bulk, PENDANT.at, 0, PENDANT.standOff + 0.003);
  const { setting, stone } = jewel();
  return { gold: mergeParts([...chain, setting.translate(at.x, at.y, at.z)]), stone: stone.translate(at.x, at.y, at.z) };
}

// Where a hip piece hangs: just outside the skirt at `angle` from the front (+ toward +X), turned to face out.
function onHip(landmarks: BodyLandmarks, bulk: number, angle: number, below: number, standOff: number, lean = 0) {
  const y = landmarks.waistY - below;
  const share = THREE.MathUtils.clamp(below / (landmarks.waistY - landmarks.hipY), 0, 1);
  const radius = THREE.MathUtils.lerp(SKIRT_WAIST.radius, SKIRT_HIP_RADIUS, share) + bulk + standOff;
  const at = new THREE.Vector3(Math.sin(angle) * radius, y, Math.cos(angle) * radius * SKIRT_WAIST.depthRatio + SKIRT_WAIST.centerZ);
  const flare = Math.atan2(SKIRT_HIP_RADIUS - SKIRT_WAIST.radius, landmarks.waistY - landmarks.hipY);
  return new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromEuler(new THREE.Euler(-flare, angle, lean, "YXZ")), new THREE.Vector3(1, 1, 1));
}

function pouch(landmarks: BodyLandmarks, bulk: number) {
  const place = onHip(landmarks, bulk, POUCH.angle, POUCH.below, POUCH.standOff);
  const body = new RoundedBoxGeometry(0.075, 0.07, 0.035, 2, 0.012);
  const flap = new RoundedBoxGeometry(0.08, 0.04, 0.01, 2, 0.004).rotateX(-0.12).translate(0, 0.017, 0.018);
  const strap = new THREE.BoxGeometry(0.018, 0.05, 0.006).translate(0, 0.045, -0.012);
  const button = new THREE.SphereGeometry(0.007, 10, 8).translate(0, 0, 0.025);
  return { leather: mergeParts([body, flap, strap]).applyMatrix4(place), gold: button.applyMatrix4(place) };
}

function scrollCase(landmarks: BodyLandmarks, bulk: number) {
  const place = onHip(landmarks, bulk, SCROLL_CASE.angle, SCROLL_CASE.below, SCROLL_CASE.standOff, SCROLL_CASE.lean);
  const half = SCROLL_CASE.length / 2;
  const capRadius = SCROLL_CASE.radius * 1.15;
  const caps = [-1, 1].map((end) => new THREE.CylinderGeometry(capRadius, capRadius, 0.02, 14).translate(0, end * half, 0));
  const ring = new THREE.TorusGeometry(SCROLL_CASE.radius * 1.05, 0.003, 4, 16).rotateX(Math.PI / 2).translate(0, half * 0.3, 0);
  return {
    leather: new THREE.CylinderGeometry(SCROLL_CASE.radius, SCROLL_CASE.radius, SCROLL_CASE.length, 14).applyMatrix4(place),
    gold: mergeParts([...caps, ring]).applyMatrix4(place),
  };
}

function buildAccentShapes(landmarks: BodyLandmarks, bulk: number) {
  return { pendant: pendant(landmarks, bulk), pouch: pouch(landmarks, bulk), scrollCase: scrollCase(landmarks, bulk) };
}

const cache = new Map<string, ReturnType<typeof buildAccentShapes>>();

// Every wizard with the same build and physique shares one set of shapes.
export function accentShapesFor(landmarks: BodyLandmarks, bulk: number) {
  const key = `${landmarks.chestY}|${landmarks.neckBaseY}|${landmarks.waistY}|${landmarks.hipY}|${bulk}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const built = buildAccentShapes(landmarks, bulk);
  cache.set(key, built);
  return built;
}
