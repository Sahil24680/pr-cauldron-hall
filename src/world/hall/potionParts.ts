import * as THREE from "three";
import { LABEL_COLUMNS, LABEL_ROWS } from "../textures";
import { type Profile, fillAttribute, lathe, merged, placed, radiusAt } from "./geometryKit";

export type BottleKind = "flask" | "vial" | "square" | "jar" | "spiral" | "gourd" | "cone";
export type Liquid = "emerald" | "violet" | "ruby" | "sapphire" | "gold" | "murky";
export type Stopper = "cork" | "wax" | "string" | "open";
export type Potion = {
  kind: BottleKind;
  at: THREE.Vector3;
  yaw: number;
  lean: number;
  scale: number;
  liquid: Liquid | null;
  fill: number;
  stopper: Stopper;
  label: number | null;
  dust: number;
  lying: boolean;
};
export type Spill = { at: THREE.Vector3; liquid: Liquid; size: number };
export type PotionParts = {
  glass: THREE.BufferGeometry;
  liquid: THREE.BufferGeometry;
  cork: THREE.BufferGeometry;
  wax: THREE.BufferGeometry;
  twine: THREE.BufferGeometry;
  labels: THREE.BufferGeometry;
  pools: THREE.BufferGeometry;
  glows: { at: THREE.Vector3; color: THREE.Color }[];
  bubbles: THREE.Vector3[];
  wisps: THREE.Vector3[];
};

type Shape = { profile: Profile; segments: number; footprint: number; neck: number; labelY: number | null; twist?: number };

const LIQUID_COLORS: Record<Liquid, string> = {
  emerald: "#2fe07a",
  violet: "#a65cff",
  ruby: "#ff2b48",
  sapphire: "#3a7bff",
  gold: "#ffc02e",
  murky: "#4c5a2a",
};
export const LIQUIDS = Object.keys(LIQUID_COLORS).filter((name): name is Liquid => name in LIQUID_COLORS);

const GLASS_THICKNESS = 0.86;
const LIQUID_FLOOR = 0.006;
const LABEL_HEIGHT = 0.042;
const LABEL_SPAN = 1.7;
const POOL_SIZE = 3.2;
const POOL_LIFT = 0.002;
const SPIRAL_RIBS = 5;
const SPIRAL_RIB_DEPTH = 0.12;
const WAX_COLORS = ["#7a1420", "#3f1a63", "#1d3d2a", "#8a5a12"];
const GLASS_TINTS = ["#ffffff", "#e8fff0", "#fff4e0", "#eef2ff"];
const BUBBLE_KINDS: BottleKind[] = ["jar", "flask", "gourd"];

export const BOTTLES: Record<BottleKind, Shape> = {
  flask: {
    profile: [
      [0, 0],
      [0.035, 0.004],
      [0.062, 0.024],
      [0.074, 0.06],
      [0.066, 0.096],
      [0.042, 0.122],
      [0.019, 0.138],
      [0.018, 0.2],
      [0.024, 0.205],
      [0.02, 0.21],
    ],
    segments: 20,
    footprint: 0.074,
    neck: 0.2,
    labelY: 0.06,
  },
  vial: {
    profile: [
      [0, 0],
      [0.016, 0.002],
      [0.02, 0.012],
      [0.02, 0.23],
      [0.016, 0.24],
      [0.022, 0.246],
      [0.018, 0.25],
    ],
    segments: 12,
    footprint: 0.022,
    neck: 0.24,
    labelY: null,
  },
  square: {
    profile: [
      [0, 0],
      [0.062, 0],
      [0.064, 0.008],
      [0.064, 0.13],
      [0.04, 0.155],
      [0.022, 0.165],
      [0.022, 0.2],
      [0.027, 0.204],
    ],
    segments: 4,
    footprint: 0.046,
    neck: 0.2,
    labelY: 0.07,
  },
  jar: {
    profile: [
      [0, 0],
      [0.06, 0],
      [0.07, 0.012],
      [0.072, 0.1],
      [0.064, 0.118],
      [0.058, 0.13],
      [0.062, 0.136],
    ],
    segments: 22,
    footprint: 0.072,
    neck: 0.13,
    labelY: 0.055,
  },
  spiral: {
    profile: [
      [0, 0],
      [0.036, 0.002],
      [0.05, 0.04],
      [0.047, 0.11],
      [0.03, 0.18],
      [0.016, 0.24],
      [0.016, 0.27],
      [0.021, 0.275],
    ],
    segments: 30,
    footprint: 0.05,
    neck: 0.27,
    labelY: null,
    twist: 16,
  },
  gourd: {
    profile: [
      [0, 0],
      [0.045, 0.004],
      [0.06, 0.035],
      [0.054, 0.075],
      [0.032, 0.098],
      [0.04, 0.128],
      [0.03, 0.158],
      [0.015, 0.175],
      [0.015, 0.215],
      [0.02, 0.22],
    ],
    segments: 20,
    footprint: 0.06,
    neck: 0.215,
    labelY: 0.04,
  },
  cone: {
    profile: [
      [0, 0],
      [0.064, 0],
      [0.066, 0.006],
      [0.022, 0.13],
      [0.02, 0.17],
      [0.025, 0.175],
    ],
    segments: 20,
    footprint: 0.066,
    neck: 0.17,
    labelY: 0.035,
  },
};

const shaped = new Map<string, THREE.BufferGeometry>();

function twistAndRib(geometry: THREE.BufferGeometry, twist: number) {
  const position = geometry.attributes.position;
  if (!position) {
    return geometry;
  }
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const angle = Math.atan2(z, x);
    const radius = Math.hypot(x, z) * (1 + SPIRAL_RIB_DEPTH * Math.cos(angle * SPIRAL_RIBS));
    const turned = angle + y * twist;
    position.setXYZ(index, Math.cos(turned) * radius, y, Math.sin(turned) * radius);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function revolve(kind: BottleKind, profile: Profile, key: string) {
  const cached = shaped.get(key);
  if (cached) {
    return cached;
  }
  const bottle = BOTTLES[kind];
  const solid = lathe(profile, bottle.segments);
  const geometry = bottle.twist ? twistAndRib(solid, bottle.twist) : solid;
  if (bottle.segments === 4) {
    geometry.rotateY(Math.PI / 4);
  }
  const finished = bottle.segments === 4 ? geometry.toNonIndexed() : geometry;
  finished.computeVertexNormals();
  shaped.set(key, finished);
  return finished;
}

function liquidProfile(profile: Profile, height: number): Profile {
  const inside: Profile = profile.filter(([, y]) => y > LIQUID_FLOOR && y < height).map(([radius, y]) => [radius * GLASS_THICKNESS, y]);
  return [
    [0, LIQUID_FLOOR],
    [radiusAt(profile, LIQUID_FLOOR) * GLASS_THICKNESS, LIQUID_FLOOR],
    ...inside,
    [radiusAt(profile, height) * GLASS_THICKNESS, height],
    [0, height],
  ];
}

function labelPiece(cell: number, radius: number, flat: boolean) {
  const geometry = flat
    ? new THREE.PlaneGeometry(radius * 1.5, LABEL_HEIGHT).translate(0, 0, radius + 0.002)
    : new THREE.CylinderGeometry(radius + 0.002, radius + 0.002, LABEL_HEIGHT, 12, 1, true, -LABEL_SPAN / 2, LABEL_SPAN);
  const uv = geometry.attributes.uv;
  const column = cell % LABEL_COLUMNS;
  const row = Math.floor(cell / LABEL_COLUMNS) % LABEL_ROWS;
  if (uv) {
    for (let index = 0; index < uv.count; index++) {
      uv.setXY(index, (column + uv.getX(index)) / LABEL_COLUMNS, (row + uv.getY(index)) / LABEL_ROWS);
    }
  }
  return geometry;
}

function poseOf(potion: Potion) {
  const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, potion.yaw, potion.lying ? -Math.PI / 2 : potion.lean));
  const lift = potion.lying ? BOTTLES[potion.kind].footprint * potion.scale : 0;
  const at = potion.at.clone().setY(potion.at.y + lift);
  return new THREE.Matrix4().compose(at, turn, new THREE.Vector3(potion.scale, potion.scale, potion.scale));
}

export function buildPotions(potions: Potion[], spills: Spill[]): PotionParts {
  const glass: THREE.BufferGeometry[] = [];
  const liquid: THREE.BufferGeometry[] = [];
  const cork: THREE.BufferGeometry[] = [];
  const wax: THREE.BufferGeometry[] = [];
  const twine: THREE.BufferGeometry[] = [];
  const labels: THREE.BufferGeometry[] = [];
  const pools: THREE.BufferGeometry[] = [];
  const glows: PotionParts["glows"] = [];
  const bubbles: THREE.Vector3[] = [];
  const wisps: THREE.Vector3[] = [];
  const pool = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  potions.forEach((potion, index) => {
    const bottle = BOTTLES[potion.kind];
    const pose = poseOf(potion);
    const neckRadius = radiusAt(bottle.profile, bottle.neck - 0.001);
    glass.push(fillAttribute(placed(revolve(potion.kind, bottle.profile, potion.kind), pose, GLASS_TINTS[index % GLASS_TINTS.length]), "aDust", [potion.dust]));
    if (potion.liquid && !potion.lying) {
      const color = new THREE.Color(LIQUID_COLORS[potion.liquid]);
      const height = Math.min(bottle.neck * potion.fill, bottle.neck - 0.01);
      const fill = revolve(potion.kind, liquidProfile(bottle.profile, height), `${potion.kind}-${height.toFixed(3)}`);
      liquid.push(placed(fill, pose, color));
      const middle = new THREE.Vector3(0, height / 2, 0).applyMatrix4(pose);
      glows.push({ at: middle, color });
      pools.push(
        placed(
          pool,
          new THREE.Matrix4().compose(
            potion.at.clone().setY(potion.at.y + POOL_LIFT),
            new THREE.Quaternion(),
            new THREE.Vector3(bottle.footprint * POOL_SIZE * potion.scale, 1, bottle.footprint * POOL_SIZE * potion.scale),
          ),
          color,
        ),
      );
      if (BUBBLE_KINDS.includes(potion.kind)) {
        bubbles.push(new THREE.Vector3(0, LIQUID_FLOOR, 0).applyMatrix4(pose));
      }
    }
    const top = new THREE.Vector3(0, bottle.neck, 0);
    if (potion.stopper === "open") {
      wisps.push(top.clone().applyMatrix4(pose));
    } else {
      const plug = new THREE.CylinderGeometry(neckRadius * 1.15, neckRadius * 0.92, 0.034, 10).translate(0, bottle.neck + 0.006, 0);
      cork.push(placed(plug, pose));
    }
    if (potion.stopper === "wax") {
      const cap = new THREE.SphereGeometry(neckRadius * 1.45, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(1, 0.75, 1).translate(0, bottle.neck + 0.014, 0);
      const drip = new THREE.CylinderGeometry(neckRadius * 1.3, neckRadius * 1.38, 0.022, 12, 1, true).translate(0, bottle.neck - 0.004, 0);
      const seal = WAX_COLORS[index % WAX_COLORS.length] ?? "#7a1420";
      wax.push(placed(cap, pose, seal), placed(drip, pose, seal));
    }
    if (potion.stopper === "string") {
      const tie = new THREE.TorusGeometry(neckRadius * 1.06, 0.0028, 4, 16).rotateX(Math.PI / 2).translate(0, bottle.neck - 0.012, 0);
      const tail = new THREE.CylinderGeometry(0.0022, 0.0022, 0.05, 4).translate(neckRadius, bottle.neck - 0.04, 0).rotateZ(-0.12);
      twine.push(placed(tie, pose), placed(tail, pose));
    }
    if (potion.label !== null && bottle.labelY !== null) {
      const radius = bottle.segments === 4 ? bottle.footprint : radiusAt(bottle.profile, bottle.labelY);
      const label = labelPiece(potion.label, radius, bottle.segments === 4).translate(0, bottle.labelY, 0);
      labels.push(placed(label, pose));
    }
  });
  const drop = new THREE.SphereGeometry(1, 10, 6).scale(1, 0.18, 1);
  for (const spill of spills) {
    liquid.push(
      placed(
        drop,
        new THREE.Matrix4().compose(spill.at, new THREE.Quaternion(), new THREE.Vector3(spill.size, spill.size, spill.size * 0.7)),
        LIQUID_COLORS[spill.liquid],
      ),
    );
  }
  return {
    glass: merged(glass),
    liquid: merged(liquid),
    cork: merged(cork),
    wax: merged(wax),
    twine: merged(twine),
    labels: merged(labels),
    pools: merged(pools),
    glows,
    bubbles,
    wisps,
  };
}
