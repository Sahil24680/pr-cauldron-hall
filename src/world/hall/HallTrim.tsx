import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { FRONT_EDGE_Z, HALL_HALF_WIDTH, WALL_HEIGHT } from "../layout";
import { runeStrip } from "../textures";
import { type Profile, merged, placed, scaleUv, tube, woodBlock } from "./geometryKit";
import { BORDER_WIDTH, FRIEZE_HEIGHT, friezeStone, inlayStone, trimStone } from "./materials";

type Props = { backZ: number; bays: number[] };

const FRIEZE_Y = WALL_HEIGHT - 0.6;
const FRIEZE_DEPTH = 0.08;
const STAINED_GLASS_HALF_WIDTH = 2.6;
const WINDOW_HALF_SPAN = 0.95;
const WINDOW_SILL_Y = 2.62;
const WINDOW_SPRING_Y = 6.2;
const HOOD_RADIUS = 1.3;
const HOOD_TUBE = 0.06;
const HOOD_STEPS = 12;
const BORDER_INSET = 0.95;
const BACK_BORDER_GAP = 1.45;
const FRONT_BORDER_GAP = 0.5;
const BORDER_LIFT = 0.004;
const RUNE_BAND_WIDTH = 0.2;
const RUNES_PER_METRE = 1;
const RUNE_GLOW = { low: 0.08, high: 0.26 };
const RUNE_PULSE_RATE = 0.45;
const SIDES = [-1, 1];

const floorRunes = new THREE.MeshBasicMaterial({
  map: runeStrip(),
  color: new THREE.Color("#8fb0ff"),
  transparent: true,
  opacity: RUNE_GLOW.low,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
});

function hoodProfile(): Profile {
  const centre = HOOD_RADIUS - WINDOW_HALF_SPAN;
  const apexRise = Math.sqrt(HOOD_RADIUS * HOOD_RADIUS - centre * centre);
  const arc: Profile = Array.from({ length: HOOD_STEPS + 1 }, (_, step) => {
    const angle = Math.PI - (step / HOOD_STEPS) * Math.atan2(apexRise, centre);
    return [centre + Math.cos(angle) * HOOD_RADIUS, WINDOW_SPRING_Y + Math.sin(angle) * HOOD_RADIUS];
  });
  const mirrored: Profile = arc
    .slice(0, -1)
    .reverse()
    .map(([x, y]) => [-x, y]);
  return [[-WINDOW_HALF_SPAN, WINDOW_SILL_Y], ...arc, ...mirrored, [WINDOW_HALF_SPAN, WINDOW_SILL_Y]];
}

function buildTrim(backZ: number, bays: number[]) {
  const depth = FRONT_EDGE_Z - backZ;
  const centerZ = (FRONT_EDGE_Z + backZ) / 2;
  const width = HALL_HALF_WIDTH * 2;
  const at = (x: number, y: number, z: number, turn = 0) => new THREE.Matrix4().makeRotationY(turn).setPosition(x, y, z);
  const frieze: THREE.BufferGeometry[] = [];
  const hoods: THREE.BufferGeometry[] = [];
  const border: THREE.BufferGeometry[] = [];
  const runes: THREE.BufferGeometry[] = [];
  const band = woodBlock(depth, FRIEZE_HEIGHT, FRIEZE_DEPTH);
  const backPiece = woodBlock(HALL_HALF_WIDTH - STAINED_GLASS_HALF_WIDTH, FRIEZE_HEIGHT, FRIEZE_DEPTH);
  for (const side of SIDES) {
    frieze.push(placed(band, at(side * (HALL_HALF_WIDTH - FRIEZE_DEPTH / 2), FRIEZE_Y, centerZ, Math.PI / 2)));
    frieze.push(placed(backPiece, at((side * (HALL_HALF_WIDTH + STAINED_GLASS_HALF_WIDTH)) / 2, FRIEZE_Y, backZ + FRIEZE_DEPTH / 2)));
  }
  frieze.push(placed(woodBlock(width, FRIEZE_HEIGHT, FRIEZE_DEPTH), at(0, FRIEZE_Y, FRONT_EDGE_Z - FRIEZE_DEPTH / 2)));
  const outline = hoodProfile();
  const hood = tube(outline, HOOD_TUBE);
  const keystone = woodBlock(0.16, 0.26, 0.14);
  const apex = outline[HOOD_STEPS + 1]?.[1] ?? WINDOW_SPRING_Y;
  for (const side of SIDES) {
    for (const z of bays) {
      const frame = at(side * (HALL_HALF_WIDTH - 0.02), 0, z, -side * (Math.PI / 2));
      hoods.push(placed(hood, frame));
      hoods.push(placed(keystone, frame.clone().multiply(new THREE.Matrix4().makeTranslation(0, apex, 0.03))));
    }
  }
  const sideLength = depth - BACK_BORDER_GAP - FRONT_BORDER_GAP;
  const sideZ = (FRONT_EDGE_Z - FRONT_BORDER_GAP + backZ + BACK_BORDER_GAP) / 2;
  const acrossLength = (HALL_HALF_WIDTH - BORDER_INSET) * 2 + BORDER_WIDTH;
  const sideBand = woodBlock(sideLength, BORDER_LIFT, BORDER_WIDTH);
  const acrossBand = woodBlock(acrossLength, BORDER_LIFT, BORDER_WIDTH);
  const sideRunes = scaleUv(new THREE.PlaneGeometry(RUNE_BAND_WIDTH, sideLength).rotateX(-Math.PI / 2), 1, sideLength * RUNES_PER_METRE);
  const acrossRunes = scaleUv(new THREE.PlaneGeometry(RUNE_BAND_WIDTH, acrossLength).rotateX(-Math.PI / 2), 1, acrossLength * RUNES_PER_METRE);
  for (const side of SIDES) {
    const x = side * (HALL_HALF_WIDTH - BORDER_INSET);
    border.push(placed(sideBand, at(x, BORDER_LIFT / 2, sideZ, Math.PI / 2)));
    runes.push(placed(sideRunes, at(x, BORDER_LIFT * 2, sideZ)));
  }
  for (const z of [backZ + BACK_BORDER_GAP, FRONT_EDGE_Z - FRONT_BORDER_GAP]) {
    border.push(placed(acrossBand, at(0, BORDER_LIFT / 2, z)));
    runes.push(placed(acrossRunes, at(0, BORDER_LIFT * 2, z, Math.PI / 2)));
  }
  return { frieze: merged(frieze), hoods: merged(hoods), border: merged(border), runes: merged(runes) };
}

export function HallTrim({ backZ, bays }: Props) {
  const trim = useMemo(() => buildTrim(backZ, bays), [backZ, bays]);
  useFrame((state) => {
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * RUNE_PULSE_RATE);
    floorRunes.opacity = THREE.MathUtils.lerp(RUNE_GLOW.low, RUNE_GLOW.high, pulse);
  });
  return (
    <group>
      <mesh geometry={trim.frieze} material={friezeStone} />
      <mesh geometry={trim.hoods} material={trimStone} />
      <mesh geometry={trim.border} material={inlayStone} />
      <mesh geometry={trim.runes} material={floorRunes} />
    </group>
  );
}
