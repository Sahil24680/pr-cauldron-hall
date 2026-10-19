import * as THREE from "three";
import { CRYSTAL_SHAPES, type CrystalShape } from "./crystalShapes";
import { type Profile, lathe, merged, placed, scroll, tube } from "./geometryKit";

export type ChandelierParts = {
  gold: THREE.BufferGeometry;
  silver: THREE.BufferGeometry;
  crystals: THREE.BufferGeometry;
  wax: THREE.BufferGeometry;
  orbs: THREE.BufferGeometry;
  flames: THREE.Vector3[];
  orbLights: THREE.Vector3[];
  glints: THREE.Vector3[];
};

const LOWER_ARMS = 10;
const LOWER_REACH = 1.12;
const LOWER_CUP_Y = 0;
const UPPER_ARMS = 6;
const UPPER_REACH = 0.62;
const UPPER_CUP_Y = 0.45;
const MIDDLE_RING = { radius: 0.74, y: -0.47 };
const INNER_RING = { radius: 0.3, y: -0.4 };
const OUTER_RING_DROP = 0.08;
const CROWN = { radius: 0.2, y: 0.9, spikes: 12 };
const CHAIN_START_Y = 1.02;
const CHAIN_LINK = { radius: 0.045, tube: 0.011, stretch: 1.6, spacing: 0.12 };
const ARM_TUBE = 0.022;
const CURL_TUBE = 0.013;
const CANDLE = { radius: 0.028, height: 0.18 };
const CUP_TOP = 0.035;
const FLAME_LIFT = 0.012;
const ORB_RADIUS = 0.055;
const BEAD_SIZE = 0.036;
const FESTOON_BEADS = 12;
const FESTOON_GLINT_EVERY = 3;
const LOWER_SAG = 0.22;
const UPPER_SAG = 0.12;
const MIDDLE_DROPS = 14;
const CASCADE_STRANDS = 8;
const CRYSTAL_TINTS = ["#ffffff", "#d3ebff", "#e3d4ff", "#ffd9e7"];
const ORB_TINTS = ["#4f8fff", "#9a5cff"];
const PENDANTS: CrystalShape[] = ["teardrop", "prism", "diamond"];
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

const STEM: Profile = [
  [0, -0.82],
  [0.04, -0.76],
  [0.09, -0.68],
  [0.05, -0.62],
  [0.07, -0.52],
  [0.14, -0.44],
  [0.18, -0.32],
  [0.16, -0.18],
  [0.1, -0.08],
  [0.05, 0],
  [0.05, 0.18],
  [0.09, 0.24],
  [0.12, 0.34],
  [0.09, 0.44],
  [0.04, 0.52],
  [0.04, 0.68],
  [0.1, 0.74],
  [0.1, 0.8],
  [0.05, 0.86],
  [0.05, 0.95],
  [0, 1.02],
];
const CUP: Profile = [
  [0.02, -0.06],
  [0.03, -0.02],
  [0.07, 0],
  [0.085, 0.025],
  [0.06, CUP_TOP],
  [0, CUP_TOP],
];
const CANOPY: Profile = [
  [0, -0.12],
  [0.06, -0.1],
  [0.2, -0.04],
  [0.26, 0],
];
const FINIAL: Profile = [
  [0, -1.02],
  [0.035, -0.96],
  [0.05, -0.9],
  [0.02, -0.84],
  [0, -0.82],
];
const LOWER_ARM: Profile = [
  [0.14, -0.3],
  [0.45, -0.54],
  [0.86, -0.48],
  [1.08, -0.24],
  [LOWER_REACH, LOWER_CUP_Y - 0.05],
];
const UPPER_ARM: Profile = [
  [0.05, 0.28],
  [0.3, 0.16],
  [0.55, 0.26],
  [UPPER_REACH, UPPER_CUP_Y - 0.05],
];

function around(index: number, count: number) {
  return (index / count) * Math.PI * 2;
}

function onCircle(radius: number, angle: number, y: number) {
  return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}

class PartsBuilder {
  readonly gold: THREE.BufferGeometry[] = [];
  readonly silver: THREE.BufferGeometry[] = [];
  readonly wax: THREE.BufferGeometry[] = [];
  readonly orbs: THREE.BufferGeometry[] = [];
  readonly crystals: THREE.BufferGeometry[] = [];
  readonly flames: THREE.Vector3[] = [];
  readonly orbLights: THREE.Vector3[] = [];
  readonly glints: THREE.Vector3[] = [];
  private tintIndex = 0;

  add(into: THREE.BufferGeometry[], geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, color?: THREE.ColorRepresentation) {
    into.push(placed(geometry, matrix, color));
  }

  aroundY(into: THREE.BufferGeometry[], geometry: THREE.BufferGeometry, angle: number) {
    this.add(into, geometry, new THREE.Matrix4().makeRotationY(-angle));
  }

  at(into: THREE.BufferGeometry[], geometry: THREE.BufferGeometry, position: THREE.Vector3, scale = 1) {
    this.add(into, geometry, new THREE.Matrix4().compose(position, new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale)));
  }

  crystal(shape: CrystalShape, top: THREE.Vector3, size: number, hangingTowards = DOWN) {
    const tint = CRYSTAL_TINTS[this.tintIndex % CRYSTAL_TINTS.length] ?? "#ffffff";
    this.tintIndex += 1;
    const turn = new THREE.Quaternion().setFromUnitVectors(DOWN, hangingTowards);
    const spin = new THREE.Quaternion().setFromAxisAngle(UP, this.tintIndex * 0.7);
    this.add(this.crystals, CRYSTAL_SHAPES[shape], new THREE.Matrix4().compose(top, turn.multiply(spin), new THREE.Vector3(size, size, size)), tint);
    return top.clone().addScaledVector(hangingTowards, size);
  }

  strand(top: THREE.Vector3, beads: number, pendant: CrystalShape, pendantSize: number) {
    let cursor = top.clone();
    for (let bead = 0; bead < beads; bead++) {
      cursor = this.crystal("bead", cursor, BEAD_SIZE);
    }
    const bottom = this.crystal(pendant, cursor, pendantSize);
    this.glints.push(cursor.clone().lerp(bottom, 0.5));
  }

  festoon(from: THREE.Vector3, to: THREE.Vector3, sag: number) {
    const sagAt = (t: number) =>
      from
        .clone()
        .lerp(to, t)
        .setY(THREE.MathUtils.lerp(from.y, to.y, t) - sag * 4 * t * (1 - t));
    for (let bead = 0; bead < FESTOON_BEADS; bead++) {
      const start = sagAt(bead / FESTOON_BEADS);
      const end = sagAt((bead + 1) / FESTOON_BEADS);
      const direction = end.clone().sub(start).normalize();
      this.crystal("bead", start, start.distanceTo(end), direction);
      if (bead % FESTOON_GLINT_EVERY === 0) {
        this.glints.push(start);
      }
    }
  }
}

function buildFrame(parts: PartsBuilder) {
  parts.at(parts.gold, lathe(STEM, 16), new THREE.Vector3());
  parts.at(parts.gold, lathe(FINIAL, 10), new THREE.Vector3());
  const lowerArm = tube(LOWER_ARM, ARM_TUBE);
  const lowerCurl = tube(scroll(0.42, -0.68, 0.13, 1.25, Math.PI * 0.45), CURL_TUBE);
  const tipCurl = tube(scroll(0.97, -0.38, 0.07, 1.1, Math.PI * 1.4), CURL_TUBE);
  const upperArm = tube(UPPER_ARM, ARM_TUBE * 0.8);
  const upperCurl = tube(scroll(0.3, 0.3, 0.09, 1.2, -Math.PI * 0.5), CURL_TUBE);
  const cup = lathe(CUP, 12);
  const candle = new THREE.CylinderGeometry(CANDLE.radius, CANDLE.radius * 1.05, CANDLE.height, 10).translate(0, CANDLE.height / 2, 0);
  const knob = new THREE.SphereGeometry(0.028, 10, 8);
  const spike = new THREE.ConeGeometry(0.018, 0.12, 6).translate(0, 0.06, 0);
  const orb = new THREE.SphereGeometry(ORB_RADIUS, 16, 12);

  for (let arm = 0; arm < LOWER_ARMS; arm++) {
    const angle = around(arm, LOWER_ARMS);
    parts.aroundY(parts.gold, lowerArm, angle);
    parts.aroundY(parts.gold, lowerCurl, angle);
    parts.aroundY(parts.silver, tipCurl, angle);
    const tip = onCircle(LOWER_REACH, angle, LOWER_CUP_Y);
    parts.at(parts.gold, cup, tip);
    parts.at(parts.wax, candle, tip.clone().setY(LOWER_CUP_Y + CUP_TOP));
    parts.flames.push(tip.clone().setY(LOWER_CUP_Y + CUP_TOP + CANDLE.height + FLAME_LIFT));
    parts.at(parts.gold, knob, onCircle(0.45, angle, -0.54));
    parts.at(parts.gold, spike, onCircle(LOWER_REACH, angle + Math.PI / LOWER_ARMS, -OUTER_RING_DROP));
  }
  for (let arm = 0; arm < UPPER_ARMS; arm++) {
    const angle = around(arm, UPPER_ARMS) + Math.PI / UPPER_ARMS;
    parts.aroundY(parts.gold, upperArm, angle);
    parts.aroundY(parts.silver, upperCurl, angle);
    const tip = onCircle(UPPER_REACH, angle, UPPER_CUP_Y);
    parts.at(parts.silver, cup, tip, 0.8);
    const light = tip.clone().setY(UPPER_CUP_Y + ORB_RADIUS + 0.02);
    parts.add(parts.orbs, orb, new THREE.Matrix4().makeTranslation(light), ORB_TINTS[arm % ORB_TINTS.length]);
    parts.orbLights.push(light);
  }
  const ring = (radius: number, thickness: number) => new THREE.TorusGeometry(radius, thickness, 8, 64).rotateX(Math.PI / 2);
  parts.at(parts.silver, ring(LOWER_REACH, 0.018), new THREE.Vector3(0, -OUTER_RING_DROP, 0));
  parts.at(parts.gold, ring(MIDDLE_RING.radius, 0.022), new THREE.Vector3(0, MIDDLE_RING.y, 0));
  parts.at(parts.silver, ring(INNER_RING.radius, 0.016), new THREE.Vector3(0, INNER_RING.y, 0));
  parts.at(parts.gold, ring(UPPER_REACH * 0.7, 0.014), new THREE.Vector3(0, 0.22, 0));
  parts.at(parts.silver, ring(CROWN.radius, 0.016), new THREE.Vector3(0, CROWN.y, 0));
  for (let index = 0; index < CROWN.spikes; index++) {
    parts.at(parts.gold, spike, onCircle(CROWN.radius, around(index, CROWN.spikes), CROWN.y), index % 2 === 0 ? 1.3 : 0.8);
  }
}

function buildChain(parts: PartsBuilder, length: number) {
  const link = new THREE.TorusGeometry(CHAIN_LINK.radius, CHAIN_LINK.tube, 6, 14).scale(1, CHAIN_LINK.stretch, 1);
  const quarterTurn = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  for (let y = CHAIN_START_Y; y < length; y += CHAIN_LINK.spacing) {
    const index = Math.round((y - CHAIN_START_Y) / CHAIN_LINK.spacing);
    const matrix = new THREE.Matrix4().makeTranslation(0, y, 0);
    parts.add(parts.gold, link, index % 2 === 0 ? matrix : matrix.multiply(quarterTurn));
  }
  parts.at(parts.gold, lathe(CANOPY, 16), new THREE.Vector3(0, length, 0));
}

function buildCrystals(parts: PartsBuilder) {
  for (let arm = 0; arm < LOWER_ARMS; arm++) {
    const angle = around(arm, LOWER_ARMS);
    const next = around(arm + 1, LOWER_ARMS);
    parts.festoon(onCircle(LOWER_REACH, angle, -OUTER_RING_DROP), onCircle(LOWER_REACH, next, -OUTER_RING_DROP), LOWER_SAG);
    parts.strand(onCircle(LOWER_REACH, angle, -OUTER_RING_DROP - 0.02), 3, PENDANTS[arm % PENDANTS.length] ?? "teardrop", 0.12);
  }
  for (let arm = 0; arm < UPPER_ARMS; arm++) {
    const angle = around(arm, UPPER_ARMS) + Math.PI / UPPER_ARMS;
    const next = around(arm + 1, UPPER_ARMS) + Math.PI / UPPER_ARMS;
    parts.festoon(onCircle(UPPER_REACH, angle, UPPER_CUP_Y - 0.06), onCircle(UPPER_REACH, next, UPPER_CUP_Y - 0.06), UPPER_SAG);
  }
  for (let drop = 0; drop < MIDDLE_DROPS; drop++) {
    const angle = around(drop, MIDDLE_DROPS) + 0.11;
    parts.strand(onCircle(MIDDLE_RING.radius, angle, MIDDLE_RING.y - 0.02), 1 + (drop % 3), PENDANTS[(drop + 1) % PENDANTS.length] ?? "prism", 0.09);
  }
  for (let strand = 0; strand < CASCADE_STRANDS; strand++) {
    const angle = around(strand, CASCADE_STRANDS);
    parts.strand(onCircle(INNER_RING.radius, angle, INNER_RING.y - 0.02), 4 + (strand % 2) * 3, strand % 2 === 0 ? "prism" : "teardrop", 0.11);
  }
  parts.strand(new THREE.Vector3(0, -1.02, 0), 2, "prism", 0.3);
  for (let index = 0; index < CROWN.spikes; index += 2) {
    parts.crystal("diamond", onCircle(CROWN.radius, around(index, CROWN.spikes) + 0.26, CROWN.y - 0.02), 0.07);
  }
}

const built = new Map<number, ChandelierParts>();

export function chandelierParts(chainLength: number): ChandelierParts {
  const cached = built.get(chainLength);
  if (cached) {
    return cached;
  }
  const parts = new PartsBuilder();
  buildFrame(parts);
  buildChain(parts, chainLength);
  buildCrystals(parts);
  const result = {
    gold: merged(parts.gold),
    silver: merged(parts.silver),
    crystals: merged(parts.crystals),
    wax: merged(parts.wax),
    orbs: merged(parts.orbs),
    flames: parts.flames,
    orbLights: parts.orbLights,
    glints: parts.glints,
  };
  built.set(chainLength, result);
  return result;
}
