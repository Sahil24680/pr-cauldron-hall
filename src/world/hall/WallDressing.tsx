import { useMemo } from "react";
import * as THREE from "three";
import { FRONT_EDGE_Z, HALL_HALF_WIDTH } from "../layout";
import { type Profile, merged, placed, tube, woodBlock } from "./geometryKit";
import { carvedOak, carvedSeal, darkOak, trimStone } from "./materials";

export type WallSpan = { from: number; to: number };
type Props = { backZ: number; bays: number[]; backWallGaps: WallSpan[] };

const WAINSCOT = { bottom: 0.35, height: 1.4, panelWidth: 0.9, boardDepth: 0.03, railDepth: 0.06, capDepth: 0.08 };
const STRING_COURSE = { y: 2.72, height: 0.14, depth: 0.12 };
const BOOKCASE_HALF_SPAN = 1.36;
const DOOR_HALF_SPAN = 2.25;
const PORTAL = { halfWidth: 2.15, spring: 5.6, radius: 2.6, tube: 0.09, steps: 14 };
const PORTAL_SEAL = { y: 6.25, radius: 0.42 };
const PAINTING_HALF_SPAN = 2.2;
const MIN_SPAN = 0.2;

function openSpans(from: number, to: number, gaps: WallSpan[]): WallSpan[] {
  const spans: WallSpan[] = [];
  let cursor = from;
  for (const gap of [...gaps].sort((a, b) => a.from - b.from)) {
    if (gap.from - cursor > MIN_SPAN) {
      spans.push({ from: cursor, to: gap.from });
    }
    cursor = Math.max(cursor, gap.to);
  }
  if (to - cursor > MIN_SPAN) {
    spans.push({ from: cursor, to });
  }
  return spans;
}

function wainscotRun(length: number) {
  const oak: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  const { bottom, height } = WAINSCOT;
  dark.push(placed(woodBlock(length, height, WAINSCOT.boardDepth), new THREE.Matrix4().makeTranslation(0, bottom + height / 2, WAINSCOT.boardDepth / 2)));
  oak.push(placed(woodBlock(length, 0.16, WAINSCOT.railDepth), new THREE.Matrix4().makeTranslation(0, bottom + 0.08, WAINSCOT.railDepth / 2)));
  oak.push(placed(woodBlock(length, 0.07, WAINSCOT.capDepth), new THREE.Matrix4().makeTranslation(0, bottom + height, WAINSCOT.capDepth / 2)));
  dark.push(
    placed(
      new THREE.CylinderGeometry(0.018, 0.018, length, 8).rotateZ(Math.PI / 2),
      new THREE.Matrix4().makeTranslation(0, bottom + height - 0.05, WAINSCOT.capDepth - 0.01),
    ),
  );
  const panels = Math.max(1, Math.round(length / WAINSCOT.panelWidth));
  const width = length / panels;
  for (let panel = 0; panel < panels; panel++) {
    const x = -length / 2 + width * (panel + 0.5);
    oak.push(
      placed(
        woodBlock(width - 0.16, height - 0.42, 0.025),
        new THREE.Matrix4().makeTranslation(x, bottom + 0.16 + (height - 0.23) / 2, WAINSCOT.boardDepth + 0.012),
      ),
    );
  }
  return { oak, dark };
}

function stringCourse(length: number) {
  return placed(woodBlock(length, STRING_COURSE.height, STRING_COURSE.depth), new THREE.Matrix4().makeTranslation(0, STRING_COURSE.y, STRING_COURSE.depth / 2));
}

function portalProfile(): Profile {
  const centre = PORTAL.radius - PORTAL.halfWidth;
  const apex = Math.atan2(Math.sqrt(PORTAL.radius ** 2 - centre ** 2), centre);
  const arc: Profile = Array.from({ length: PORTAL.steps + 1 }, (_, step) => {
    const angle = Math.PI - (step / PORTAL.steps) * (Math.PI - apex);
    return [centre + Math.cos(angle) * PORTAL.radius, PORTAL.spring + Math.sin(angle) * PORTAL.radius];
  });
  const mirrored: Profile = arc
    .slice(0, -1)
    .reverse()
    .map(([x, y]) => [-x, y]);
  return [[-PORTAL.halfWidth, 0], ...arc, ...mirrored, [PORTAL.halfWidth, 0]];
}

function buildWalls(backZ: number, bays: number[], backWallGaps: WallSpan[]) {
  const oak: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  const stone: THREE.BufferGeometry[] = [];
  const facing = (origin: THREE.Vector3, turn: number) => new THREE.Matrix4().makeRotationY(turn).setPosition(origin);
  const dress = (spans: WallSpan[], origin: (centre: number) => THREE.Vector3, turn: number, course: WallSpan[]) => {
    for (const span of spans) {
      const run = wainscotRun(span.to - span.from);
      const frame = facing(origin((span.from + span.to) / 2), turn);
      oak.push(...run.oak.map((piece) => piece.applyMatrix4(frame)));
      dark.push(...run.dark.map((piece) => piece.applyMatrix4(frame)));
    }
    for (const span of course) {
      stone.push(stringCourse(span.to - span.from).applyMatrix4(facing(origin((span.from + span.to) / 2), turn)));
    }
  };
  const bookcaseGaps = bays.map((z) => ({ from: z - BOOKCASE_HALF_SPAN, to: z + BOOKCASE_HALF_SPAN }));
  for (const side of [-1, 1]) {
    const spans = openSpans(backZ, FRONT_EDGE_Z, bookcaseGaps);
    dress(spans, (z) => new THREE.Vector3(side * HALL_HALF_WIDTH, 0, z), -side * (Math.PI / 2), [{ from: backZ, to: FRONT_EDGE_Z }]);
  }
  const backSpans = openSpans(-HALL_HALF_WIDTH, HALL_HALF_WIDTH, backWallGaps);
  const backCourse = openSpans(-HALL_HALF_WIDTH, HALL_HALF_WIDTH, [...backWallGaps, { from: -PAINTING_HALF_SPAN, to: PAINTING_HALF_SPAN }]);
  dress(backSpans, (x) => new THREE.Vector3(x, 0, backZ), 0, backCourse);
  const frontSpans = openSpans(-HALL_HALF_WIDTH, HALL_HALF_WIDTH, [{ from: -DOOR_HALF_SPAN, to: DOOR_HALF_SPAN }]);
  dress(frontSpans, (x) => new THREE.Vector3(x, 0, FRONT_EDGE_Z), Math.PI, frontSpans);
  const portal = new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0, 0, FRONT_EDGE_Z - 0.16);
  stone.push(placed(tube(portalProfile(), PORTAL.tube), portal));
  const seal = placed(new THREE.CircleGeometry(PORTAL_SEAL.radius, 40), portal.clone().multiply(new THREE.Matrix4().makeTranslation(0, PORTAL_SEAL.y, 0.02)));
  return { oak: merged(oak), dark: merged(dark), stone: merged(stone), seal };
}

export function WallDressing({ backZ, bays, backWallGaps }: Props) {
  const walls = useMemo(() => buildWalls(backZ, bays, backWallGaps), [backZ, bays, backWallGaps]);
  return (
    <group>
      <mesh geometry={walls.oak} material={carvedOak} />
      <mesh geometry={walls.dark} material={darkOak} />
      <mesh geometry={walls.stone} material={trimStone} />
      <mesh geometry={walls.seal} material={carvedSeal} />
    </group>
  );
}
