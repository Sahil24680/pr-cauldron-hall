import { useMemo } from "react";
import * as THREE from "three";
import { FRONT_EDGE_Z, HALL_HALF_WIDTH, WALL_HEIGHT } from "../layout";
import { SKY_PANEL_VARIANTS, roseWindow, skyPanels } from "./artwork";
import { type Profile, lathe, merged, placed, tube, woodBlock } from "./geometryKit";
import { carvedOak, darkOak, gold, masonry, trimStone } from "./materials";

type Props = { backZ: number; trusses: number[] };

export const TIE_BEAM_HEIGHT = 0.32;
const ROOF_PEAK = 3.2;
const EAVE = HALL_HALF_WIDTH + 0.3;
const SLOPE_LENGTH = Math.hypot(EAVE, ROOF_PEAK);
const TIE_BEAM_DEPTH = 0.36;
const RAFTER = { thickness: 0.3, width: 0.32 };
const PURLIN_STATIONS = [0.24, 0.5, 0.76];
const COFFER_EDGES = [0.03, ...PURLIN_STATIONS, 0.98];
const PURLIN = { width: 0.2, depth: 0.22, offset: -0.06 };
const RIB = { width: 0.16 };
const PANEL_OFFSET = -0.17;
const BOSS_OFFSET = 0.05;
// Truss and pendant positions as shares of the half width, so the roof keeps its rhythm if the hall is resized.
const QUEEN_POST_X = HALL_HALF_WIDTH * 0.344;
const BRACE = { springX: HALL_HALF_WIDTH - 0.25, springY: WALL_HEIGHT - 1.2, footX: HALL_HALF_WIDTH * 0.752, radius: 0.11, steps: 10 };
const PENDANT_SIDE_X = HALL_HALF_WIDTH * 0.44;
const PENDANT_XS = [0, -PENDANT_SIDE_X, PENDANT_SIDE_X, -BRACE.footX, BRACE.footX];
const ROSE = { y: 10.55, radius: 1.05, frame: 0.08 };
const PANEL_GLOW = 0.4;
const SIDES = [-1, 1];
const PENDANT: Profile = [
  [0, -0.42],
  [0.04, -0.4],
  [0.07, -0.3],
  [0.05, -0.2],
  [0.09, -0.12],
  [0.06, -0.02],
  [0.1, 0],
];
const ROSETTE: Profile = [
  [0, 0.09],
  [0.04, 0.08],
  [0.09, 0.05],
  [0.13, 0.02],
  [0.16, 0],
];

const skyTexture = skyPanels();
const sky = new THREE.MeshStandardMaterial({ map: skyTexture, emissiveMap: skyTexture, emissive: "#ffffff", emissiveIntensity: PANEL_GLOW, roughness: 0.9 });
const roseGlass = new THREE.MeshBasicMaterial({ map: roseWindow(), color: new THREE.Color(1.1, 1.1, 1.2), toneMapped: false });

function slopeFrame(side: number, along: number, offset: number, z: number) {
  const eave = new THREE.Vector3(side * EAVE, WALL_HEIGHT, z);
  const up = new THREE.Vector3(-side * EAVE, ROOF_PEAK, 0).normalize();
  const down = new THREE.Vector3(up.y, -up.x, 0);
  if (down.y > 0) {
    down.negate();
  }
  const across = new THREE.Vector3().crossVectors(up, down);
  return new THREE.Matrix4().makeBasis(across, up, down).setPosition(eave.addScaledVector(up, along * SLOPE_LENGTH).addScaledVector(down, offset));
}

function coffersAlong(backZ: number, trusses: number[]) {
  const ribs = trusses.slice(0, -1).map((z, index) => (z + (trusses[index + 1] ?? z)) / 2);
  const lines = [...trusses, ...ribs].filter((z) => z > backZ && z < FRONT_EDGE_Z).sort((a, b) => a - b);
  return { ribs, edges: [backZ, ...lines, FRONT_EDGE_Z] };
}

function buildTrusses(trusses: number[]) {
  const timber: THREE.BufferGeometry[] = [];
  const trim: THREE.BufferGeometry[] = [];
  const gilt: THREE.BufferGeometry[] = [];
  const angle = Math.atan2(ROOF_PEAK, EAVE);
  const pendant = lathe(PENDANT, 12);
  for (const z of trusses) {
    const at = (x: number, y: number, turn = 0) => new THREE.Matrix4().makeRotationZ(turn).setPosition(x, y, z);
    timber.push(placed(woodBlock(EAVE * 2, TIE_BEAM_HEIGHT, TIE_BEAM_DEPTH), at(0, WALL_HEIGHT)));
    trim.push(placed(woodBlock(EAVE * 2, 0.06, TIE_BEAM_DEPTH + 0.06), at(0, WALL_HEIGHT - TIE_BEAM_HEIGHT / 2 - 0.02)));
    timber.push(placed(woodBlock(0.26, ROOF_PEAK, 0.3), at(0, WALL_HEIGHT + ROOF_PEAK / 2)));
    for (const side of SIDES) {
      timber.push(placed(woodBlock(SLOPE_LENGTH, RAFTER.thickness, RAFTER.width), at((side * EAVE) / 2, WALL_HEIGHT + ROOF_PEAK / 2, -side * angle)));
      const queenTop = WALL_HEIGHT + ROOF_PEAK * (1 - QUEEN_POST_X / EAVE) - RAFTER.thickness / 2;
      const queenBottom = WALL_HEIGHT + TIE_BEAM_HEIGHT / 2;
      timber.push(placed(woodBlock(0.2, queenTop - queenBottom, 0.24), at(side * QUEEN_POST_X, (queenTop + queenBottom) / 2)));
      const arc: Profile = Array.from({ length: BRACE.steps + 1 }, (_, step) => {
        const sweep = (step / BRACE.steps) * (Math.PI / 2);
        const reachX = BRACE.springX - BRACE.footX;
        const reachY = WALL_HEIGHT - TIE_BEAM_HEIGHT / 2 - BRACE.springY;
        return [side * (BRACE.footX + Math.cos(sweep) * reachX), BRACE.springY + Math.sin(sweep) * reachY];
      });
      timber.push(placed(tube(arc, BRACE.radius), new THREE.Matrix4().makeTranslation(0, 0, z)));
    }
    for (const x of PENDANT_XS) {
      gilt.push(placed(pendant, at(x, WALL_HEIGHT - TIE_BEAM_HEIGHT / 2)));
    }
  }
  return { timber, trim, gilt };
}

function buildRoof(backZ: number, trusses: number[]) {
  const timber: THREE.BufferGeometry[] = [];
  const gilt: THREE.BufferGeometry[] = [];
  const panels: THREE.BufferGeometry[] = [];
  const { ribs, edges } = coffersAlong(backZ, trusses);
  const length = FRONT_EDGE_Z - backZ;
  const centreZ = (FRONT_EDGE_Z + backZ) / 2;
  const rosette = lathe(ROSETTE, 14).rotateX(Math.PI / 2);
  let variant = 0;
  for (const side of SIDES) {
    for (const station of PURLIN_STATIONS) {
      timber.push(placed(woodBlock(length, PURLIN.width, PURLIN.depth), slopeFrame(side, station, PURLIN.offset, centreZ)));
      for (const z of [...ribs, ...trusses]) {
        gilt.push(placed(rosette, slopeFrame(side, station, BOSS_OFFSET, z)));
      }
    }
    timber.push(placed(woodBlock(length, 0.34, 0.3), slopeFrame(side, 1, PURLIN.offset, centreZ)));
    for (const z of ribs) {
      timber.push(placed(woodBlock(RIB.width, SLOPE_LENGTH * 0.96, PURLIN.depth), slopeFrame(side, 0.5, PURLIN.offset, z)));
    }
    for (let edge = 0; edge < edges.length - 1; edge++) {
      const from = edges[edge] ?? backZ;
      const to = edges[edge + 1] ?? FRONT_EDGE_Z;
      for (let strip = 0; strip < COFFER_EDGES.length - 1; strip++) {
        const low = COFFER_EDGES[strip] ?? 0;
        const high = COFFER_EDGES[strip + 1] ?? 1;
        const panel = new THREE.PlaneGeometry(to - from, (high - low) * SLOPE_LENGTH);
        const uv = panel.attributes.uv;
        const column = variant % SKY_PANEL_VARIANTS;
        variant += 1;
        if (uv) {
          for (let index = 0; index < uv.count; index++) {
            uv.setX(index, (column + uv.getX(index)) / SKY_PANEL_VARIANTS);
          }
        }
        panels.push(placed(panel, slopeFrame(side, (low + high) / 2, PANEL_OFFSET, (from + to) / 2)));
      }
    }
  }
  return { timber, gilt, panels };
}

function buildGables(backZ: number) {
  const wall: THREE.BufferGeometry[] = [];
  const glass: THREE.BufferGeometry[] = [];
  const frames: THREE.BufferGeometry[] = [];
  const triangle = new THREE.Shape([
    new THREE.Vector2(-EAVE, WALL_HEIGHT),
    new THREE.Vector2(EAVE, WALL_HEIGHT),
    new THREE.Vector2(0, WALL_HEIGHT + ROOF_PEAK),
  ]);
  triangle.holes.push(new THREE.Path().absarc(0, ROSE.y, ROSE.radius, 0, Math.PI * 2, true));
  const gable = new THREE.ShapeGeometry(triangle, 24);
  const disc = new THREE.CircleGeometry(ROSE.radius, 48).translate(0, ROSE.y, 0);
  const ring = new THREE.TorusGeometry(ROSE.radius, ROSE.frame, 8, 48).translate(0, ROSE.y, 0);
  for (const [z, turn] of [
    [backZ, 0],
    [FRONT_EDGE_Z, Math.PI],
  ] as const) {
    const frame = new THREE.Matrix4().makeRotationY(turn).setPosition(0, 0, z);
    wall.push(placed(gable, frame));
    glass.push(placed(disc, frame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.02))));
    frames.push(placed(ring, frame));
  }
  return { wall: merged(wall), glass: merged(glass), frames: merged(frames) };
}

// The roof is closed and panelled; the chandeliers and crests hang from the tie beams these trusses carry.
export function Ceiling({ backZ, trusses }: Props) {
  const built = useMemo(() => {
    const frame = buildTrusses(trusses);
    const roof = buildRoof(backZ, trusses);
    return {
      timber: merged([...frame.timber, ...roof.timber]),
      trim: merged(frame.trim),
      gilt: merged([...frame.gilt, ...roof.gilt]),
      panels: merged(roof.panels),
      gables: buildGables(backZ),
    };
  }, [backZ, trusses]);
  return (
    <group>
      <mesh geometry={built.timber} material={darkOak} />
      <mesh geometry={built.trim} material={carvedOak} />
      <mesh geometry={built.gilt} material={gold} />
      <mesh geometry={built.panels} material={sky} />
      <mesh geometry={built.gables.wall} material={masonry} />
      <mesh geometry={built.gables.glass} material={roseGlass} />
      <mesh geometry={built.gables.frames} material={trimStone} />
    </group>
  );
}
