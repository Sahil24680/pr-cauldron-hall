import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useCameraBlocker } from "../player/cameraBlockers";
import { type BillboardSize, Billboards } from "./Billboards";
import { type Profile, lathe, merged, placeAt, placed, scroll, tube } from "./geometryKit";
import { billboardQuad, createFlameMaterial, createGlowMaterial, flameQuad } from "./glowShaders";
import { gold, wroughtIron } from "./materials";
import { createDriftGeometry, createDriftMaterial } from "./particles";

type Props = { lit: boolean; hue: number };

const MAGIC_HUES = ["#8f5cff", "#3f86ff", "#2fe0a0"];
const CUP_HEIGHT = 0.3;
const CUP_OUT = 0.36;
const CUP_TOP = 0.1;
const FLAME_BASE = new THREE.Vector3(0, CUP_HEIGHT + CUP_TOP - 0.02, CUP_OUT);
const PRONGS = 7;
const LIGHT_INTENSITY = 9;
const LIGHT_OFFSET: [number, number, number] = [0, 0.75, 0.62];
const EMBERS = 14;
const SMOKE_PUFFS = 9;
const SMOKE_START = 0.42;

const PLATE_OUTLINE: Profile = [
  [0, -0.22],
  [0.05, -0.16],
  [0.06, -0.09],
  [0.095, -0.03],
  [0.07, 0.04],
  [0.085, 0.12],
  [0.045, 0.19],
  [0, 0.24],
];
const CUP: Profile = [
  [0, -0.05],
  [0.025, -0.04],
  [0.04, -0.01],
  [0.07, 0.03],
  [0.095, 0.08],
  [0.11, CUP_TOP],
  [0.098, CUP_TOP],
];
const FINIAL: Profile = [
  [0, -0.14],
  [0.018, -0.12],
  [0.03, -0.09],
  [0.012, -0.06],
  [0.02, -0.04],
];
const ARM: Profile = [
  [0.02, -0.02],
  [0.16, -0.08],
  [0.3, 0.02],
  [CUP_OUT, CUP_HEIGHT - 0.05],
];
const MAGIC_FLAME_AT = [FLAME_BASE.clone().setY(FLAME_BASE.y - 0.02)];
const MAGIC_FLAME_SIZES: BillboardSize[] = [[0.4, 0.68]];
const WARM_FLAME_AT = [FLAME_BASE, FLAME_BASE.clone().add(new THREE.Vector3(-0.045, 0, 0.01)), FLAME_BASE.clone().add(new THREE.Vector3(0.05, 0, -0.01))];
const WARM_FLAME_SIZES: BillboardSize[] = [
  [0.2, 0.4],
  [0.1, 0.24],
  [0.09, 0.28],
];
const HALO_AT = [FLAME_BASE.clone().setY(FLAME_BASE.y + 0.15), FLAME_BASE.clone().setY(FLAME_BASE.y + 0.22)];
const HALO_SIZES: BillboardSize[] = [[1.1, 1.1]];
const WARM_HALO = new THREE.Color("#ff9a40");

const toWall = new THREE.Matrix4().makeRotationY(-Math.PI / 2);

function plateShape(scale: number) {
  const outline = [
    ...PLATE_OUTLINE,
    ...PLATE_OUTLINE.slice(1, -1)
      .reverse()
      .map(([x, y]): [number, number] => [-x, y]),
  ];
  return new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x * scale, y * scale)));
}

function buildSconce() {
  const iron: THREE.BufferGeometry[] = [];
  const trim: THREE.BufferGeometry[] = [];
  const plate = (scale: number, depth: number) =>
    new THREE.ExtrudeGeometry(plateShape(scale), { depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2 });
  trim.push(placed(plate(1.18, 0.012), placeAt(0, 0, -0.02)));
  iron.push(placed(plate(1, 0.02), placeAt(0, 0, -0.004)));
  trim.push(placed(new THREE.SphereGeometry(0.03, 12, 8), placeAt(0, 0.02, 0.03)));
  trim.push(placed(new THREE.SphereGeometry(0.018, 10, 6), placeAt(0, 0.19, 0.02)));
  iron.push(placed(tube(ARM, 0.018), toWall));
  for (const side of [-1, 1]) {
    const curl = tube(scroll(0.12, -0.13, 0.07, 1.2, side > 0 ? Math.PI * 0.2 : Math.PI * 0.8), 0.009);
    trim.push(placed(curl, new THREE.Matrix4().makeRotationY(-Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(side * 0.035, 0, 0))));
  }
  trim.push(placed(tube(scroll(0.24, 0.12, 0.06, 1.1, Math.PI * 1.1), 0.008), toWall));
  const cupAt = placeAt(0, CUP_HEIGHT, CUP_OUT);
  iron.push(placed(lathe(CUP, 14), cupAt));
  trim.push(placed(new THREE.TorusGeometry(0.106, 0.009, 6, 28).rotateX(Math.PI / 2), placeAt(0, CUP_HEIGHT + CUP_TOP, CUP_OUT)));
  trim.push(placed(lathe(FINIAL, 10), cupAt));
  const prong = new THREE.ConeGeometry(0.012, 0.09, 5).translate(0, 0.045, 0);
  for (let index = 0; index < PRONGS; index++) {
    const angle = (index / PRONGS) * Math.PI * 2;
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(angle) * 0.35, 0, -Math.cos(angle) * 0.35));
    const at = new THREE.Vector3(Math.cos(angle) * 0.1, CUP_HEIGHT + CUP_TOP, CUP_OUT + Math.sin(angle) * 0.1);
    trim.push(placed(prong, new THREE.Matrix4().compose(at, tilt, new THREE.Vector3(1, 1, 1))));
  }
  return { iron: merged(iron), trim: merged(trim) };
}

const sconce = buildSconce();
const embers = new THREE.CylinderGeometry(0.085, 0.07, 0.03, 12);
const emberBed = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.7, 0.18), toneMapped: false });
const magicFlame = createFlameMaterial({ core: "#b9c4ff", mid: "#ffffff", edge: "#ffffff", intensity: 0.8, midTint: 1 });
const warmFlame = createFlameMaterial({ core: "#fff1c8", mid: "#ff8a24", edge: "#d8380a", intensity: 1.2 });
const halo = createGlowMaterial({ color: "#ffffff", intensity: 0.7, pulse: 0.1 });
const sparks = createDriftMaterial({
  color: new THREE.Color(2.4, 1.6, 0.6),
  colorEnd: "#ff3a10",
  velocity: [0, 0.55, 0],
  wander: 0.18,
  life: 2.2,
  size: 0.025,
  opacity: 1,
  twinkle: 0.5,
  shape: "soft",
  additive: true,
});
const smoke = createDriftMaterial({
  color: "#2c2830",
  colorEnd: "#4a4650",
  velocity: [0, 0.32, 0.04],
  wander: 0.22,
  life: 4.5,
  size: 0.1,
  sizeEnd: 0.55,
  opacity: 0.22,
  twinkle: 0,
  shape: "soft",
  additive: false,
});
const sparkSpawn = createDriftGeometry(EMBERS, 3, (random) => [(random() - 0.5) * 0.1, FLAME_BASE.y + random() * 0.15, FLAME_BASE.z + (random() - 0.5) * 0.1]);
const smokeSpawn = createDriftGeometry(SMOKE_PUFFS, 4, (random) => [(random() - 0.5) * 0.06, FLAME_BASE.y + SMOKE_START, FLAME_BASE.z]);

export function Torch({ lit, hue }: Props) {
  const light = useRef<THREE.PointLight>(null);
  const bracket = useRef<THREE.Group>(null);
  useCameraBlocker(bracket);
  const tints = useMemo(() => {
    const magic = new THREE.Color(MAGIC_HUES[hue % MAGIC_HUES.length] ?? "#8f5cff");
    return { flame: [magic], halo: [WARM_HALO, magic] };
  }, [hue]);
  useFrame((state) => {
    if (!light.current) {
      return;
    }
    const t = state.clock.elapsedTime + hue * 3.1;
    light.current.intensity = LIGHT_INTENSITY * (0.82 + Math.sin(t * 11) * 0.08 + Math.sin(t * 23) * 0.06 + Math.sin(t * 3.7) * 0.05);
  });
  return (
    <group>
      <group ref={bracket}>
        <mesh geometry={sconce.iron} material={wroughtIron} />
        <mesh geometry={sconce.trim} material={gold} />
      </group>
      <mesh geometry={embers} material={emberBed} position={[0, CUP_HEIGHT + CUP_TOP - 0.025, CUP_OUT]} />
      <Billboards at={MAGIC_FLAME_AT} sizes={MAGIC_FLAME_SIZES} geometry={flameQuad} material={magicFlame} tints={tints.flame} />
      <Billboards at={WARM_FLAME_AT} sizes={WARM_FLAME_SIZES} geometry={flameQuad} material={warmFlame} />
      <Billboards at={HALO_AT} sizes={HALO_SIZES} geometry={billboardQuad} material={halo} tints={tints.halo} />
      <points geometry={sparkSpawn} material={sparks} frustumCulled={false} />
      <points geometry={smokeSpawn} material={smoke} frustumCulled={false} />
      {lit && <pointLight ref={light} position={LIGHT_OFFSET} distance={11} decay={1.6} color="#ff9f4a" />}
    </group>
  );
}
