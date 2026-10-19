import { useMemo } from "react";
import * as THREE from "three";
import { seededRandom } from "../textures";
import { PotionSet } from "./PotionSet";
import { carvedOak, darkOak, shadowWood } from "./materials";
import { BOTTLES, type BottleKind, LIQUIDS, type Potion, type Spill, type Stopper } from "./potionParts";

type Props = { x: number; backZ: number; seed: number };

const SHELF_WIDTH = 2.3;
const SHELF_DEPTH = 0.45;
const WALL_OFFSET = 0.35;
const BOARD_THICKNESS = 0.07;
const FIRST_BOARD_Y = 1.04;
const BOARD_SPACING = 0.8;
const ROWS = 3;
const EDGE_MARGIN = 0.08;
const GAP_CHANCE = 0.16;
const BACK_ROW_CHANCE = 0.4;
const LEAN_CHANCE = 0.14;
const DUSTY_CHANCE = 0.35;
const LABEL_CHANCE = 0.55;
const MIN_SCALE = 1.15;
const SCALE_SPREAD = 0.45;
const KINDS = Object.keys(BOTTLES).filter((kind): kind is BottleKind => kind in BOTTLES);
const STOPPERS: Stopper[] = ["cork", "wax", "string", "cork", "open", "wax"];
const BACK_ROW_Z = -0.11;
const PANEL_BOTTOM = 0.6;
const PANEL_HEADROOM = 0.55;
const FRONT_ROW_Z = 0.05;

const box = new THREE.BoxGeometry(1, 1, 1);
const lip = new THREE.CylinderGeometry(0.022, 0.022, 1, 10).rotateZ(Math.PI / 2);
const corbel = new THREE.ExtrudeGeometry(
  (() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.34, 0);
    shape.quadraticCurveTo(0.33, -0.08, 0.22, -0.1);
    shape.quadraticCurveTo(0.06, -0.12, 0.05, -0.3);
    shape.lineTo(0, -0.3);
    shape.closePath();
    return shape;
  })(),
  { depth: 0.06, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 },
).rotateY(-Math.PI / 2);

function pick<T>(options: T[], random: () => number, fallback: T) {
  return options[Math.floor(random() * options.length)] ?? fallback;
}

function stopperFor(kind: BottleKind, lying: boolean, random: () => number): Stopper {
  if (lying) {
    return "open";
  }
  const stopper = pick(STOPPERS, random, "cork");
  return kind === "jar" && stopper === "wax" ? "cork" : stopper;
}

function arrangeShelf(seed: number) {
  const random = seededRandom(seed);
  const potions: Potion[] = [];
  const spills: Spill[] = [];
  const tippedRow = Math.floor(random() * ROWS);
  for (let row = 0; row < ROWS; row++) {
    const y = FIRST_BOARD_Y + row * BOARD_SPACING + BOARD_THICKNESS / 2;
    let cursor = -SHELF_WIDTH / 2 + EDGE_MARGIN;
    let previous: BottleKind | null = null;
    let tipped = row !== tippedRow;
    while (cursor < SHELF_WIDTH / 2 - EDGE_MARGIN) {
      if (random() < GAP_CHANCE) {
        cursor += 0.1 + random() * 0.14;
        continue;
      }
      const kind = pick(
        KINDS.filter((option) => option !== previous),
        random,
        "flask",
      );
      const scale = MIN_SCALE + random() * SCALE_SPREAD;
      const half = BOTTLES[kind].footprint * scale;
      const lying = !tipped && kind === "vial";
      const reach = lying ? BOTTLES[kind].neck * scale : half * 2;
      if (cursor + reach > SHELF_WIDTH / 2 - EDGE_MARGIN) {
        break;
      }
      const backRow = !lying && random() < BACK_ROW_CHANCE;
      const at = new THREE.Vector3(cursor + (lying ? 0 : half), y, backRow ? BACK_ROW_Z : FRONT_ROW_Z + (random() - 0.5) * 0.06);
      potions.push({
        kind,
        at,
        yaw: lying ? 0.15 : random() * Math.PI * 2,
        lean: random() < LEAN_CHANCE ? (random() - 0.5) * 0.3 : 0,
        scale,
        liquid: lying ? null : pick(LIQUIDS, random, "emerald"),
        fill: 0.25 + random() * 0.6,
        stopper: stopperFor(kind, lying, random),
        label: random() < LABEL_CHANCE ? Math.floor(random() * 8) : null,
        dust: random() < DUSTY_CHANCE ? 0.4 + random() * 0.5 : 0,
        lying,
      });
      if (lying) {
        tipped = true;
        const mouth = cursor + reach;
        spills.push(
          { at: new THREE.Vector3(mouth + 0.05, y, at.z + 0.03), liquid: "violet", size: 0.035 },
          { at: new THREE.Vector3(mouth + 0.12, y, at.z + 0.07), liquid: "violet", size: 0.018 },
        );
      }
      previous = kind;
      cursor += reach + 0.012 + random() * 0.03;
    }
  }
  return { potions, spills };
}

export function PotionShelf({ x, backZ, seed }: Props) {
  const { potions, spills } = useMemo(() => arrangeShelf(seed), [seed]);
  const top = FIRST_BOARD_Y + (ROWS - 1) * BOARD_SPACING + PANEL_HEADROOM;
  return (
    <group position={[x, 0, backZ + WALL_OFFSET]}>
      <mesh
        geometry={box}
        material={shadowWood}
        scale={[SHELF_WIDTH + 0.12, top - PANEL_BOTTOM, 0.04]}
        position={[0, (top + PANEL_BOTTOM) / 2, -SHELF_DEPTH / 2 + 0.02]}
      />
      <group position={[0, top, -SHELF_DEPTH / 4]}>
        <mesh geometry={box} material={darkOak} scale={[SHELF_WIDTH + 0.24, 0.09, SHELF_DEPTH / 2 + 0.08]} />
        <mesh geometry={lip} material={carvedOak} scale={[1.2, SHELF_WIDTH + 0.28, 1.2]} position={[0, -0.05, SHELF_DEPTH / 4 + 0.04]} />
      </group>
      {Array.from({ length: ROWS }, (_, row) => {
        const y = FIRST_BOARD_Y + row * BOARD_SPACING;
        return (
          <group key={row} position={[0, y, 0]}>
            <mesh geometry={box} material={carvedOak} scale={[SHELF_WIDTH, BOARD_THICKNESS, SHELF_DEPTH]} />
            <mesh geometry={lip} material={darkOak} scale={[1, SHELF_WIDTH + 0.04, 1]} position={[0, -0.01, SHELF_DEPTH / 2]} />
            {[-1, 1].map((side) => (
              <mesh key={side} geometry={corbel} material={darkOak} position={[side * (SHELF_WIDTH / 2 - 0.12), -BOARD_THICKNESS / 2, -SHELF_DEPTH / 2]} />
            ))}
          </group>
        );
      })}
      <PotionSet potions={potions} spills={spills} seed={seed} />
    </group>
  );
}
