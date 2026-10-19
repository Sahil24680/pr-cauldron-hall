import * as THREE from "three";
import { CRYSTAL_SHAPES } from "./crystalShapes";
import { type Profile, lathe, placed } from "./geometryKit";

export type CurioKind = "scrolls" | "skull" | "hourglass" | "orb" | "candle" | "crystals";
export type CurioPieces = {
  parchment: THREE.BufferGeometry[];
  bone: THREE.BufferGeometry[];
  brass: THREE.BufferGeometry[];
  soot: THREE.BufferGeometry[];
  wood: THREE.BufferGeometry[];
  ribbon: THREE.BufferGeometry[];
  sand: THREE.BufferGeometry[];
  clearGlass: THREE.BufferGeometry[];
  crystals: THREE.BufferGeometry[];
  wax: THREE.BufferGeometry[];
  orbCores: THREE.BufferGeometry[];
  flames: THREE.Vector3[];
  glows: { at: THREE.Vector3; color: THREE.Color }[];
};

export const CURIO_WIDTH: Record<CurioKind, number> = {
  scrolls: 0.24,
  skull: 0.16,
  hourglass: 0.12,
  orb: 0.14,
  candle: 0.1,
  crystals: 0.14,
};
export const CURIO_KINDS = Object.keys(CURIO_WIDTH).filter((kind): kind is CurioKind => kind in CURIO_WIDTH);

const RIBBON_COLORS = ["#8a1c24", "#1f3f7a", "#2f5f2a"];
const GLOW_CRYSTAL_TINTS = ["#7fd8ff", "#c79cff", "#7dffc0", "#ff9ccf"];
const ORB_COLORS = ["#9b6bff", "#4fa8ff", "#38e0a0"];
const CANDLE = { radius: 0.022, height: 0.12 };

const HOURGLASS_BULB: Profile = [
  [0.006, 0],
  [0.03, 0.02],
  [0.038, 0.045],
  [0.032, 0.065],
  [0.004, 0.075],
];
const ORB_STAND: Profile = [
  [0, 0],
  [0.05, 0],
  [0.052, 0.012],
  [0.03, 0.02],
  [0.018, 0.045],
  [0.03, 0.06],
  [0.042, 0.07],
];
const CANDLE_DISH: Profile = [
  [0, 0],
  [0.045, 0],
  [0.05, 0.012],
  [0.04, 0.01],
  [0.012, 0.014],
  [0.012, 0.03],
];

const scrollRoll = new THREE.CylinderGeometry(0.024, 0.024, 0.22, 12).rotateX(Math.PI / 2);
const scrollBand = new THREE.TorusGeometry(0.026, 0.004, 4, 14);
const cranium = new THREE.SphereGeometry(0.062, 16, 12);
const socket = new THREE.SphereGeometry(0.016, 8, 6);
const unit = new THREE.BoxGeometry(1, 1, 1);
const bulb = lathe(HOURGLASS_BULB, 14);
const post = new THREE.CylinderGeometry(0.004, 0.004, 0.155, 5);
const cap = new THREE.CylinderGeometry(0.048, 0.048, 0.012, 14);
const sandHeap = new THREE.ConeGeometry(0.028, 0.025, 12);
const orbShell = new THREE.SphereGeometry(0.055, 20, 14);
const orbCore = new THREE.SphereGeometry(0.03, 14, 10);
const stand = lathe(ORB_STAND, 14);
const candleDish = lathe(CANDLE_DISH, 14);
const candleStick = new THREE.CylinderGeometry(CANDLE.radius, CANDLE.radius * 1.08, CANDLE.height, 10).translate(0, CANDLE.height / 2, 0);
const drip = new THREE.SphereGeometry(0.007, 6, 4).scale(1, 2.2, 1);
const rock = new THREE.SphereGeometry(0.05, 7, 5).scale(1.2, 0.45, 1);
const upright = new THREE.Matrix4().makeRotationX(Math.PI);

function pose(frame: THREE.Matrix4, x: number, y: number, z: number, rotation = new THREE.Euler(), scale = new THREE.Vector3(1, 1, 1)) {
  return frame.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(rotation), scale));
}

function addScrolls(pieces: CurioPieces, frame: THREE.Matrix4, random: () => number) {
  const layout: [number, number][] = [
    [-0.03, 0.024],
    [0.03, 0.024],
    [0, 0.066],
  ];
  layout.forEach(([x, y], index) => {
    const turn = new THREE.Euler(0, (random() - 0.5) * 0.5, 0);
    pieces.parchment.push(placed(scrollRoll, pose(frame, x, y, 0, turn)));
    const ribbon = RIBBON_COLORS[index % RIBBON_COLORS.length] ?? "#8a1c24";
    pieces.ribbon.push(placed(scrollBand, pose(frame, x, y, 0.02, turn), ribbon));
  });
}

function addSkull(pieces: CurioPieces, frame: THREE.Matrix4, random: () => number) {
  const turn = new THREE.Euler(0, (random() - 0.5) * 0.8, 0);
  const skull = pose(frame, 0, 0, 0, turn);
  pieces.bone.push(
    placed(
      cranium,
      skull.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, 0.07, -0.01), new THREE.Quaternion(), new THREE.Vector3(1, 0.95, 1.12))),
    ),
  );
  pieces.bone.push(
    placed(
      cranium,
      skull.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, 0.04, 0.03), new THREE.Quaternion(), new THREE.Vector3(0.72, 0.62, 0.7))),
    ),
  );
  pieces.bone.push(
    placed(
      unit,
      skull.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, 0.012, 0.045), new THREE.Quaternion(), new THREE.Vector3(0.06, 0.022, 0.04))),
    ),
  );
  for (const side of [-1, 1]) {
    pieces.soot.push(placed(socket, skull.clone().multiply(new THREE.Matrix4().makeTranslation(side * 0.022, 0.06, 0.06))));
  }
  pieces.soot.push(
    placed(
      socket,
      skull.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(0, 0.035, 0.07), new THREE.Quaternion(), new THREE.Vector3(0.45, 0.6, 0.4))),
    ),
  );
}

function addHourglass(pieces: CurioPieces, frame: THREE.Matrix4) {
  pieces.wood.push(placed(cap, pose(frame, 0, 0.006, 0)), placed(cap, pose(frame, 0, 0.17, 0)));
  pieces.clearGlass.push(placed(bulb, pose(frame, 0, 0.012, 0)));
  pieces.clearGlass.push(placed(bulb, pose(frame, 0, 0.164, 0).multiply(upright)));
  pieces.sand.push(placed(sandHeap, pose(frame, 0, 0.026, 0)));
  pieces.sand.push(placed(sandHeap, pose(frame, 0, 0.13, 0).multiply(upright)));
  for (let index = 0; index < 3; index++) {
    const angle = (index / 3) * Math.PI * 2;
    pieces.wood.push(placed(post, pose(frame, Math.cos(angle) * 0.041, 0.088, Math.sin(angle) * 0.041)));
  }
}

function addOrb(pieces: CurioPieces, frame: THREE.Matrix4, random: () => number) {
  const color = new THREE.Color(ORB_COLORS[Math.floor(random() * ORB_COLORS.length)] ?? "#9b6bff");
  pieces.brass.push(placed(stand, pose(frame, 0, 0, 0)));
  pieces.clearGlass.push(placed(orbShell, pose(frame, 0, 0.12, 0)));
  pieces.orbCores.push(placed(orbCore, pose(frame, 0, 0.12, 0), color));
  pieces.glows.push({ at: new THREE.Vector3(0, 0.12, 0).applyMatrix4(frame), color });
}

function addCandle(pieces: CurioPieces, frame: THREE.Matrix4, random: () => number) {
  const height = 0.6 + random() * 0.6;
  pieces.brass.push(placed(candleDish, pose(frame, 0, 0, 0)));
  pieces.wax.push(placed(candleStick, pose(frame, 0, 0.03, 0, new THREE.Euler(), new THREE.Vector3(1, height, 1))));
  for (let index = 0; index < 3; index++) {
    const angle = random() * Math.PI * 2;
    pieces.wax.push(
      placed(drip, pose(frame, Math.cos(angle) * CANDLE.radius, 0.03 + CANDLE.height * height * (0.6 + random() * 0.35), Math.sin(angle) * CANDLE.radius)),
    );
  }
  pieces.flames.push(new THREE.Vector3(0, 0.03 + CANDLE.height * height + 0.006, 0).applyMatrix4(frame));
}

function addCrystals(pieces: CurioPieces, frame: THREE.Matrix4, random: () => number) {
  const tint = GLOW_CRYSTAL_TINTS[Math.floor(random() * GLOW_CRYSTAL_TINTS.length)] ?? "#7fd8ff";
  pieces.soot.push(placed(rock, pose(frame, 0, 0.012, 0)));
  const shards = 3 + Math.floor(random() * 3);
  for (let index = 0; index < shards; index++) {
    const lean = new THREE.Euler((random() - 0.5) * 0.7 + Math.PI, random() * Math.PI, (random() - 0.5) * 0.7);
    const size = 0.07 + random() * 0.08;
    pieces.crystals.push(
      placed(
        CRYSTAL_SHAPES.prism,
        pose(frame, (random() - 0.5) * 0.06, 0.01, (random() - 0.5) * 0.04, lean, new THREE.Vector3(size * 1.4, size, size * 1.4)),
        tint,
      ),
    );
  }
  pieces.glows.push({ at: new THREE.Vector3(0, 0.07, 0).applyMatrix4(frame), color: new THREE.Color(tint) });
}

export function emptyCurioPieces(): CurioPieces {
  return {
    parchment: [],
    bone: [],
    brass: [],
    soot: [],
    wood: [],
    ribbon: [],
    sand: [],
    clearGlass: [],
    crystals: [],
    wax: [],
    orbCores: [],
    flames: [],
    glows: [],
  };
}

type CurioBuilder = (pieces: CurioPieces, frame: THREE.Matrix4, random: () => number) => void;

const BUILDERS: Record<CurioKind, CurioBuilder> = {
  scrolls: addScrolls,
  skull: addSkull,
  hourglass: addHourglass,
  orb: addOrb,
  candle: addCandle,
  crystals: addCrystals,
};

export function addCurio(kind: CurioKind, pieces: CurioPieces, frame: THREE.Matrix4, random: () => number) {
  BUILDERS[kind](pieces, frame, random);
}
