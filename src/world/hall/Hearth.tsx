import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { WALL_HEIGHT } from "../layout";
import { radialGlow, seededRandom } from "../textures";
import { type BillboardSize, Billboards } from "./Billboards";
import { PotionSet } from "./PotionSet";
import { barkTexture, sketchTexture } from "./artwork";
import { addCurio, emptyCurioPieces } from "./curios";
import { type Profile, lathe, merged, placed, scroll, tube, woodBlock } from "./geometryKit";
import { billboardQuad, createFlameMaterial, createGlowMaterial, flameQuad } from "./glowShaders";
import {
  candleFlame,
  candleHalo,
  candleWax,
  carvedSeal,
  clearGlass,
  darkOak,
  friezeStone,
  gold,
  inlayStone,
  masonry,
  trimStone,
  wroughtIron,
} from "./materials";
import { createDriftGeometry, createDriftMaterial } from "./particles";
import type { Liquid, Potion, Spill } from "./potionParts";

type Props = { x: number; backZ: number; withPot: boolean; seed: number };

const OPENING = { halfWidth: 1.1, height: 1.9, backHalfWidth: 0.75, backZ: 0.12 };
const SURROUND = { halfWidth: 1.8, depth: 0.9, lintelTop: 2.4 };
const MANTEL = { halfWidth: 2, thickness: 0.12, depth: 1.1 };
const BREAST = { halfWidth: 1.5, depth: 0.7 };
const MANTEL_TOP = SURROUND.lintelTop + MANTEL.thickness;
const SEAL = { y: 5.6, radius: 0.45 };
const APRON = { halfWidth: 1.9, depth: 0.7, height: 0.05 };
const GRATE = { y: 0.22, halfLength: 0.6, front: 0.66, back: 0.34 };
const FIRE_Z = 0.5;
const LIGHT_POSITION: [number, number, number] = [0, 0.8, 1.4];
const LIGHT_INTENSITY = 14;
const FLOOR_GLOW = { z: 2.1, width: 4.2, depth: 2.6, low: 0.28, high: 0.5 };
const POT = { pivotX: -1.02, armY: 1.45, hangX: -0.25, hangY: 0.8, stir: 0.08, stirRate: 1.4 };
const TONGUE_SIZES: BillboardSize[] = [
  [0.42, 0.66],
  [0.55, 0.95],
  [0.7, 1.15],
  [0.55, 0.9],
  [0.4, 0.62],
  [0.3, 0.45],
];
const TONGUES = [-0.42, -0.22, 0, 0.2, 0.4, 0.08].map((offset, index) => new THREE.Vector3(offset, 0.36 + (index % 2) * 0.03, FIRE_Z - (index % 3) * 0.05));
const FIRE_GLOW_AT = [new THREE.Vector3(0, 0.75, FIRE_Z + 0.25)];
const FIRE_GLOW_SIZES: BillboardSize[] = [[2.6, 1.8]];
const CANDLE_FLAME_SIZES: BillboardSize[] = [[0.06, 0.15]];
const CANDLE_HALO_SIZES: BillboardSize[] = [[0.34, 0.34]];
const MANTEL_FRONT = MANTEL.depth - 0.18;
const CANDLESTICK: Profile = [
  [0, 0],
  [0.07, 0],
  [0.075, 0.015],
  [0.03, 0.03],
  [0.02, 0.12],
  [0.035, 0.2],
  [0.015, 0.24],
  [0.04, 0.26],
  [0.03, 0.27],
];
const CANDLESTICK_TOP = 0.27;
const CANDLE_HEIGHT = 0.26;
const POT_PROFILE: Profile = [
  [0, -0.2],
  [0.12, -0.19],
  [0.2, -0.12],
  [0.23, 0],
  [0.21, 0.09],
  [0.19, 0.12],
  [0.22, 0.14],
];
const LOGS: { at: [number, number, number]; yaw: number; radius: number; length: number; roll: number }[] = [
  { at: [0, 0.31, 0.42], yaw: 0, radius: 0.085, length: 1.05, roll: 0 },
  { at: [0.02, 0.3, 0.6], yaw: 0.05, radius: 0.075, length: 1, roll: 0 },
  { at: [-0.05, 0.44, 0.5], yaw: 0.28, radius: 0.07, length: 0.92, roll: 0.06 },
  { at: [0.28, 0.42, 0.52], yaw: -0.7, radius: 0.06, length: 0.6, roll: -0.25 },
];

const soot = new THREE.MeshStandardMaterial({ color: "#1c1612", roughness: 1 });
const ash = new THREE.MeshStandardMaterial({ color: "#2a2420", roughness: 1, emissive: "#ff5a1a", emissiveIntensity: 0.12 });
const bark = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 1 });
const emberEnds = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.75, 0.2), toneMapped: false });
const sketch = new THREE.MeshStandardMaterial({ map: sketchTexture(), roughness: 0.9 });
const fire = createFlameMaterial({ core: "#fff0c0", mid: "#ff9a2a", edge: "#d0380a", intensity: 1.45 });
const fireGlow = createGlowMaterial({ color: "#ff7a2a", intensity: 0.32, pulse: 0.14 });
const floorGlow = new THREE.MeshBasicMaterial({
  color: "#ff8a3c",
  alphaMap: radialGlow(),
  transparent: true,
  opacity: FLOOR_GLOW.low,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const brewLook = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.3, 0.5), toneMapped: false });
const sparks = createDriftMaterial({
  color: new THREE.Color(2.4, 1.4, 0.5),
  colorEnd: "#ff3a10",
  velocity: [0, 0.7, -0.12],
  wander: 0.25,
  life: 2.2,
  size: 0.028,
  opacity: 1,
  twinkle: 0.5,
  shape: "soft",
  additive: true,
});
const smoke = createDriftMaterial({
  color: "#2a2628",
  colorEnd: "#3e3a40",
  velocity: [0, 0.32, -0.09],
  wander: 0.18,
  life: 4.2,
  size: 0.14,
  sizeEnd: 0.6,
  opacity: 0.2,
  twinkle: 0,
  shape: "soft",
  additive: false,
});
const steam = createDriftMaterial({
  color: "#d8e8e0",
  velocity: [0, 0.22, 0],
  wander: 0.12,
  life: 3,
  size: 0.06,
  sizeEnd: 0.32,
  opacity: 0.12,
  twinkle: 0,
  shape: "soft",
  additive: true,
});
const sparkSpawn = createDriftGeometry(30, 13, (random) => [(random() - 0.5) * 1, 0.4 + random() * 0.3, FIRE_Z + (random() - 0.5) * 0.25]);
const smokeSpawn = createDriftGeometry(12, 17, (random) => [(random() - 0.5) * 0.6, 0.9 + random() * 0.2, FIRE_Z - 0.1]);
const steamSpawn = createDriftGeometry(10, 23, (random) => [POT.hangX + (random() - 0.5) * 0.25, POT.hangY + 0.16, FIRE_Z + (random() - 0.5) * 0.2]);

function corbel() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.22, 0);
  shape.quadraticCurveTo(0.2, -0.12, 0.08, -0.16);
  shape.quadraticCurveTo(0.02, -0.22, 0.04, -0.34);
  shape.lineTo(0, -0.34);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 }).rotateY(-Math.PI / 2);
}

function slab(width: number, height: number, depth: number, x: number, y: number, z: number, turn = 0) {
  return placed(woodBlock(width, height, depth), new THREE.Matrix4().makeRotationY(turn).setPosition(x, y, z));
}

function buildSurround() {
  const stone: THREE.BufferGeometry[] = [];
  const trim: THREE.BufferGeometry[] = [];
  const firebox: THREE.BufferGeometry[] = [];
  const jambWidth = SURROUND.halfWidth - OPENING.halfWidth;
  for (const side of [-1, 1]) {
    const jambX = side * (OPENING.halfWidth + jambWidth / 2);
    stone.push(slab(jambWidth, OPENING.height, SURROUND.depth, jambX, OPENING.height / 2, SURROUND.depth / 2));
    trim.push(slab(0.3, OPENING.height - 0.3, 0.06, jambX, OPENING.height / 2, SURROUND.depth + 0.03));
    trim.push(slab(0.42, 0.14, 0.1, jambX, 0.07, SURROUND.depth + 0.04));
    trim.push(slab(0.42, 0.12, 0.1, jambX, OPENING.height - 0.08, SURROUND.depth + 0.04));
    trim.push(placed(corbel(), new THREE.Matrix4().makeTranslation(side * (SURROUND.halfWidth - 0.15) + 0.1, SURROUND.lintelTop, SURROUND.depth)));
    const cheekLength = Math.hypot(OPENING.halfWidth - OPENING.backHalfWidth, SURROUND.depth - OPENING.backZ);
    const cheekTurn = side * Math.atan2(OPENING.halfWidth - OPENING.backHalfWidth, SURROUND.depth - OPENING.backZ);
    const cheekX = side * (OPENING.halfWidth + OPENING.backHalfWidth) * 0.5;
    firebox.push(slab(0.04, OPENING.height, cheekLength, cheekX, OPENING.height / 2, (SURROUND.depth + OPENING.backZ) / 2, cheekTurn));
  }
  stone.push(
    slab(SURROUND.halfWidth * 2, SURROUND.lintelTop - OPENING.height, SURROUND.depth, 0, (SURROUND.lintelTop + OPENING.height) / 2, SURROUND.depth / 2),
  );
  firebox.push(slab(SURROUND.halfWidth * 2, OPENING.height, OPENING.backZ, 0, OPENING.height / 2, OPENING.backZ / 2));
  stone.push(slab(BREAST.halfWidth * 2, WALL_HEIGHT - MANTEL_TOP, BREAST.depth, 0, (WALL_HEIGHT + MANTEL_TOP) / 2, BREAST.depth / 2));
  trim.push(slab(MANTEL.halfWidth * 2, MANTEL.thickness, MANTEL.depth, 0, SURROUND.lintelTop + MANTEL.thickness / 2, MANTEL.depth / 2));
  trim.push(
    placed(
      new THREE.CylinderGeometry(0.05, 0.05, MANTEL.halfWidth * 2 - 0.1, 12).rotateZ(Math.PI / 2),
      new THREE.Matrix4().makeTranslation(0, SURROUND.lintelTop - 0.02, MANTEL.depth - 0.06),
    ),
  );
  trim.push(slab(BREAST.halfWidth * 2 + 0.12, 0.14, BREAST.depth + 0.08, 0, MANTEL_TOP + 0.07, BREAST.depth / 2));
  firebox.push(slab(OPENING.halfWidth * 2, 0.04, SURROUND.depth - OPENING.backZ, 0, OPENING.height + 0.02, (SURROUND.depth + OPENING.backZ) / 2));
  firebox.push(slab(OPENING.halfWidth * 2, 0.03, SURROUND.depth - OPENING.backZ, 0, 0.015, (SURROUND.depth + OPENING.backZ) / 2));
  const frieze = slab(OPENING.halfWidth * 2, 0.3, 0.03, 0, (SURROUND.lintelTop + OPENING.height) / 2, SURROUND.depth + 0.015);
  const apron = slab(APRON.halfWidth * 2, APRON.height, APRON.depth, 0, APRON.height / 2, SURROUND.depth + APRON.depth / 2);
  const seal = placed(new THREE.CircleGeometry(SEAL.radius, 48), new THREE.Matrix4().makeTranslation(0, SEAL.y, BREAST.depth + 0.004));
  const sealRing = placed(new THREE.TorusGeometry(SEAL.radius + 0.04, 0.05, 10, 48), new THREE.Matrix4().makeTranslation(0, SEAL.y, BREAST.depth));
  return { stone: merged(stone), trim: merged([...trim, sealRing]), firebox: merged(firebox), frieze, apron, seal };
}

function buildIronwork() {
  const iron: THREE.BufferGeometry[] = [];
  const brass: THREE.BufferGeometry[] = [];
  const rod = (length: number) => new THREE.CylinderGeometry(0.014, 0.014, length, 8);
  for (let bar = 0; bar < 5; bar++) {
    const z = THREE.MathUtils.lerp(GRATE.back, GRATE.front, bar / 4);
    iron.push(placed(rod(GRATE.halfLength * 2).rotateZ(Math.PI / 2), new THREE.Matrix4().makeTranslation(0, GRATE.y, z)));
  }
  for (const side of [-1, 1]) {
    iron.push(
      placed(
        rod(GRATE.front - GRATE.back + 0.06).rotateX(Math.PI / 2),
        new THREE.Matrix4().makeTranslation(side * GRATE.halfLength, GRATE.y, (GRATE.front + GRATE.back) / 2),
      ),
    );
    for (const z of [GRATE.back, GRATE.front]) {
      iron.push(placed(rod(GRATE.y), new THREE.Matrix4().makeTranslation(side * (GRATE.halfLength - 0.04), GRATE.y / 2, z)));
    }
    const andiron = side * 0.62;
    iron.push(placed(new THREE.CylinderGeometry(0.02, 0.025, 0.44, 8), new THREE.Matrix4().makeTranslation(andiron, 0.22, GRATE.front + 0.12)));
    iron.push(placed(woodBlock(0.04, 0.03, 0.32), new THREE.Matrix4().makeTranslation(andiron, 0.015, GRATE.front + 0.02)));
    brass.push(placed(new THREE.SphereGeometry(0.045, 12, 10), new THREE.Matrix4().makeTranslation(andiron, 0.48, GRATE.front + 0.12)));
  }
  return { iron: merged(iron), brass: merged(brass) };
}

function buildLogs() {
  const bodies: THREE.BufferGeometry[] = [];
  const ends: THREE.BufferGeometry[] = [];
  for (const log of LOGS) {
    const pose = new THREE.Matrix4().compose(
      new THREE.Vector3(...log.at),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, log.yaw, Math.PI / 2 + log.roll)),
      new THREE.Vector3(1, 1, 1),
    );
    bodies.push(placed(new THREE.CylinderGeometry(log.radius, log.radius * 1.08, log.length, 9, 1, true), pose));
    for (const end of [-1, 1]) {
      const cap = new THREE.CircleGeometry(log.radius * 0.98, 9).rotateX((end * -Math.PI) / 2).translate(0, (end * log.length) / 2, 0);
      ends.push(placed(cap, pose));
    }
  }
  return { bark: merged(bodies), ends: merged(ends) };
}

function buildMantelProps() {
  const brass: THREE.BufferGeometry[] = [];
  const wax: THREE.BufferGeometry[] = [];
  const flames: THREE.Vector3[] = [];
  const frame: THREE.BufferGeometry[] = [];
  const stick = lathe(CANDLESTICK, 14);
  for (const side of [-1, 1]) {
    const x = side * (MANTEL.halfWidth - 0.3);
    brass.push(placed(stick, new THREE.Matrix4().makeTranslation(x, MANTEL_TOP, MANTEL_FRONT)));
    wax.push(
      placed(
        new THREE.CylinderGeometry(0.022, 0.024, CANDLE_HEIGHT, 10),
        new THREE.Matrix4().makeTranslation(x, MANTEL_TOP + CANDLESTICK_TOP + CANDLE_HEIGHT / 2, MANTEL_FRONT),
      ),
    );
    flames.push(new THREE.Vector3(x, MANTEL_TOP + CANDLESTICK_TOP + CANDLE_HEIGHT + 0.008, MANTEL_FRONT));
  }
  const lean = new THREE.Matrix4().makeRotationX(-0.14).setPosition(0, MANTEL_TOP + 0.33, BREAST.depth + 0.07);
  for (const side of [-1, 1]) {
    frame.push(placed(woodBlock(0.06, 0.66, 0.04), lean.clone().multiply(new THREE.Matrix4().makeTranslation(side * 0.43, 0, 0))));
    frame.push(placed(woodBlock(0.92, 0.06, 0.04), lean.clone().multiply(new THREE.Matrix4().makeTranslation(0, side * 0.3, 0))));
  }
  const canvas = placed(new THREE.PlaneGeometry(0.8, 0.54), lean.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.005)));
  const curios = emptyCurioPieces();
  addCurio("hourglass", curios, new THREE.Matrix4().makeTranslation(-0.95, MANTEL_TOP, MANTEL_FRONT), seededRandom(7));
  return { brass: merged([...brass, ...frame]), wax: merged(wax), flames, canvas, hourglass: curios };
}

function buildPot() {
  const iron: THREE.BufferGeometry[] = [];
  iron.push(placed(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), new THREE.Matrix4().makeTranslation(POT.pivotX, 0.95, FIRE_Z)));
  iron.push(
    placed(
      tube(
        [
          [POT.pivotX, POT.armY],
          [(POT.pivotX + POT.hangX) / 2, POT.armY + 0.05],
          [POT.hangX, POT.armY],
        ],
        0.018,
      ),
      new THREE.Matrix4().makeTranslation(0, 0, FIRE_Z),
    ),
  );
  iron.push(placed(tube(scroll(POT.pivotX + 0.2, POT.armY - 0.15, 0.1, 1.1, Math.PI * 0.5), 0.01), new THREE.Matrix4().makeTranslation(0, 0, FIRE_Z)));
  iron.push(
    placed(
      new THREE.CylinderGeometry(0.008, 0.008, POT.armY - POT.hangY - 0.16, 6),
      new THREE.Matrix4().makeTranslation(POT.hangX, (POT.armY + POT.hangY + 0.16) / 2, FIRE_Z),
    ),
  );
  iron.push(placed(lathe(POT_PROFILE, 20), new THREE.Matrix4().makeTranslation(POT.hangX, POT.hangY, FIRE_Z)));
  const brew = placed(new THREE.CircleGeometry(0.19, 20).rotateX(-Math.PI / 2), new THREE.Matrix4().makeTranslation(POT.hangX, POT.hangY + 0.1, FIRE_Z));
  const ladle = merged([
    placed(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 6).translate(0, 0.21, 0), new THREE.Matrix4()),
    placed(new THREE.SphereGeometry(0.04, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.Matrix4()),
  ]);
  return { iron: merged(iron), brew, ladle };
}

// The ladle needs no hand: it keeps circling the pot, tilted out over the rim.
function StirringLadle({ ladle }: { ladle: THREE.BufferGeometry }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const angle = state.clock.elapsedTime * POT.stirRate;
    mesh.current?.position.set(POT.hangX + Math.cos(angle) * POT.stir, POT.hangY + 0.02, FIRE_Z + Math.sin(angle) * POT.stir);
    mesh.current?.rotation.set(Math.sin(angle) * 0.35, 0, -Math.cos(angle) * 0.35);
  });
  return <mesh ref={mesh} geometry={ladle} material={wroughtIron} />;
}

const MANTEL_POTIONS: { kind: Potion["kind"]; liquid: Liquid }[] = [
  { kind: "vial", liquid: "ruby" },
  { kind: "square", liquid: "gold" },
  { kind: "flask", liquid: "violet" },
];

function mantelPotions(seed: number): Potion[] {
  return MANTEL_POTIONS.map(({ kind, liquid }, index) => ({
    kind,
    at: new THREE.Vector3(0.75 + index * 0.13, MANTEL_TOP, MANTEL_FRONT - (index % 2) * 0.08),
    yaw: seed + index,
    lean: 0,
    scale: 0.9,
    liquid,
    fill: 0.4 + index * 0.15,
    stopper: index === 2 ? "wax" : "cork",
    label: index === 1 ? seed % 8 : null,
    dust: 0.3,
    lying: false,
  }));
}

const NO_SPILLS: Spill[] = [];

export function Hearth({ x, backZ, withPot, seed }: Props) {
  const light = useRef<THREE.PointLight>(null);
  const parts = useMemo(() => ({ surround: buildSurround(), ironwork: buildIronwork(), logs: buildLogs(), mantel: buildMantelProps(), pot: buildPot() }), []);
  const potions = useMemo(() => mantelPotions(seed), [seed]);
  const hourglass = useMemo(
    () => ({ wood: merged(parts.mantel.hourglass.wood), glass: merged(parts.mantel.hourglass.clearGlass), sand: merged(parts.mantel.hourglass.sand) }),
    [parts],
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime + x;
    const wave = Math.sin(t * 9) * 0.18 + Math.sin(t * 17) * 0.1 + Math.sin(t * 3.1) * 0.08;
    if (light.current) {
      light.current.intensity = LIGHT_INTENSITY * (1 + wave);
    }
    floorGlow.opacity = THREE.MathUtils.lerp(FLOOR_GLOW.low, FLOOR_GLOW.high, 0.5 + wave);
  });
  return (
    <group position={[x, 0, backZ]}>
      <mesh geometry={parts.surround.stone} material={masonry} />
      <mesh geometry={parts.surround.trim} material={trimStone} />
      <mesh geometry={parts.surround.firebox} material={soot} />
      <mesh geometry={parts.surround.frieze} material={friezeStone} />
      <mesh geometry={parts.surround.apron} material={inlayStone} />
      <mesh geometry={parts.surround.seal} material={carvedSeal} />
      <mesh material={ash} position={[0, 0.035, FIRE_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.4, 0.5]} />
      </mesh>
      <mesh geometry={parts.ironwork.iron} material={wroughtIron} />
      <mesh geometry={parts.ironwork.brass} material={gold} />
      <mesh geometry={parts.logs.bark} material={bark} />
      <mesh geometry={parts.logs.ends} material={emberEnds} />
      <Billboards at={TONGUES} sizes={TONGUE_SIZES} geometry={flameQuad} material={fire} />
      <Billboards at={FIRE_GLOW_AT} sizes={FIRE_GLOW_SIZES} geometry={billboardQuad} material={fireGlow} />
      <points geometry={sparkSpawn} material={sparks} frustumCulled={false} />
      <points geometry={smokeSpawn} material={smoke} frustumCulled={false} />
      <mesh material={floorGlow} position={[0, 0.008, FLOOR_GLOW.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FLOOR_GLOW.width, FLOOR_GLOW.depth]} />
      </mesh>
      <mesh geometry={parts.mantel.brass} material={gold} />
      <mesh geometry={parts.mantel.wax} material={candleWax} />
      <mesh geometry={parts.mantel.canvas} material={sketch} />
      <mesh geometry={hourglass.wood} material={darkOak} />
      <mesh geometry={hourglass.sand} material={gold} />
      <mesh geometry={hourglass.glass} material={clearGlass} />
      <Billboards at={parts.mantel.flames} sizes={CANDLE_FLAME_SIZES} geometry={flameQuad} material={candleFlame} />
      <Billboards at={parts.mantel.flames} sizes={CANDLE_HALO_SIZES} geometry={billboardQuad} material={candleHalo} />
      <PotionSet potions={potions} spills={NO_SPILLS} seed={seed} />
      {withPot && (
        <group>
          <mesh geometry={parts.pot.iron} material={wroughtIron} />
          <mesh geometry={parts.pot.brew} material={brewLook} />
          <StirringLadle ladle={parts.pot.ladle} />
          <points geometry={steamSpawn} material={steam} frustumCulled={false} />
        </group>
      )}
      <pointLight ref={light} position={LIGHT_POSITION} distance={12} decay={1.6} color="#ff8a3c" />
    </group>
  );
}
