import type { PullRequest, Stage } from "../../shared/board";
import { findStage } from "../../shared/stage";
import { STAGE_ORDER } from "../lib/theme";

export type Point = { x: number; z: number };
export type Station = { stage: Stage; cauldron: Point; spot: Point; facing: number; stacked: boolean };
export type Post = { spot: Point; facing: number };
export type BookRun = { pickup: Post; drop: Post };
export type Stack = { stage: Stage; station: Station; lectern: Point; numbers: number[]; brewers: Post[]; bookRun: BookRun };
export type Zone = { stage: Stage; x: number; startZ: number; endZ: number };
export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };

export const ZONE_SPACING = 6.6;
export const FRONT_Z = 6;
export const FRONT_EDGE_Z = FRONT_Z + 12;
export const FRONT_CORRIDOR_Z = FRONT_Z + 3;
export const DOOR: Point = { x: 0, z: FRONT_EDGE_Z - 1 };
export const HALL_HALF_WIDTH = 15;
export const WALL_HEIGHT = 9;
export const CAULDRON_RADIUS = 0.62;
export const GRAND_CAULDRON_RADIUS = 0.95;
const LECTERN_HALF_WIDTH = 0.36;
export const MAX_WIZARDS_PER_ZONE = 4;
const COLUMNS = 2;
const ZONE_ROWS = MAX_WIZARDS_PER_ZONE / COLUMNS;
const COLUMN_OFFSET = 1.6;
const ROW_SPACING = 3.4;
const WIZARD_DISTANCE = 1;
const ZONE_MARGIN = 2;
const BACK_CLEARANCE = 6;
const HEADMASTER_SPOT = { x: -0.5, z: -2.4 };
const LECTERN_AHEAD = 0.62;
const GRAND_CAULDRON_BESIDE = { x: 1.75, z: 1.1 };
const STUDENT_HALF_WIDTH = 0.3;
// Students brewing at the grand cauldron: one behind it, one on the side away from the Headmaster.
const BREWERS_AROUND_CAULDRON: Point[] = [
  { x: 0.25, z: -1.45 },
  { x: 1.4, z: 0.2 },
];
const BOOK_PICKUP_AHEAD = 0.65;
const BOOK_DROP_AROUND_CAULDRON: Point = { x: -0.3, z: 1.4 };

export function zoneX(stage: Stage) {
  return (STAGE_ORDER.indexOf(stage) - (STAGE_ORDER.length - 1) / 2) * ZONE_SPACING;
}

function squareAround(point: Point, halfWidth: number): Rect {
  return { minX: point.x - halfWidth, maxX: point.x + halfWidth, minZ: point.z - halfWidth, maxZ: point.z + halfWidth };
}

function offset(from: Point, by: Point): Point {
  return { x: from.x + by.x, z: from.z + by.z };
}

export function facingToward(from: Point, to: Point) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

function postFacing(spot: Point, toward: Point): Post {
  return { spot, facing: facingToward(spot, toward) };
}

function layoutStack(stage: Stage, numbers: number[]): Stack {
  const spot = { x: zoneX(stage) + HEADMASTER_SPOT.x, z: FRONT_Z + HEADMASTER_SPOT.z };
  const cauldron = offset(spot, GRAND_CAULDRON_BESIDE);
  const lectern = { x: spot.x, z: spot.z + LECTERN_AHEAD };
  return {
    stage,
    station: { stage, cauldron, spot, facing: 0, stacked: true },
    lectern,
    numbers,
    brewers: BREWERS_AROUND_CAULDRON.map((around) => postFacing(offset(cauldron, around), cauldron)),
    bookRun: {
      pickup: postFacing({ x: lectern.x, z: lectern.z + BOOK_PICKUP_AHEAD }, lectern),
      drop: postFacing(offset(cauldron, BOOK_DROP_AROUND_CAULDRON), cauldron),
    },
  };
}

// A zone seats up to four wizards; a busier stage is handed to one Headmaster so the hall never grows.
export function layoutHall(pullRequests: PullRequest[]) {
  const stations = new Map<number, Station>();
  const stacks = new Map<Stage, Stack>();
  const zones: Zone[] = [];
  const obstacles: Rect[] = [];
  for (const stage of STAGE_ORDER) {
    const brewing = pullRequests.filter((pr) => findStage(pr) === stage).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const x = zoneX(stage);
    zones.push({ stage, x, startZ: FRONT_Z + ZONE_MARGIN, endZ: FRONT_Z - (ZONE_ROWS - 1) * ROW_SPACING - WIZARD_DISTANCE - ZONE_MARGIN });
    if (brewing.length > MAX_WIZARDS_PER_ZONE) {
      const stack = layoutStack(
        stage,
        brewing.map((pr) => pr.number),
      );
      stacks.set(stage, stack);
      for (const pr of brewing) {
        stations.set(pr.number, stack.station);
      }
      obstacles.push(
        squareAround(stack.station.cauldron, GRAND_CAULDRON_RADIUS),
        squareAround(stack.lectern, LECTERN_HALF_WIDTH),
        ...stack.brewers.map((brewer) => squareAround(brewer.spot, STUDENT_HALF_WIDTH)),
      );
      continue;
    }
    brewing.forEach((pr, index) => {
      const cauldron = { x: x + (index % COLUMNS === 0 ? -COLUMN_OFFSET : COLUMN_OFFSET), z: FRONT_Z - Math.floor(index / COLUMNS) * ROW_SPACING };
      stations.set(pr.number, { stage, cauldron, spot: { x: cauldron.x, z: cauldron.z - WIZARD_DISTANCE }, facing: 0, stacked: false });
      obstacles.push(squareAround(cauldron, CAULDRON_RADIUS));
    });
  }
  const backZ = Math.min(...zones.map((zone) => zone.endZ)) - BACK_CLEARANCE;
  return { stations, stacks, zones, backZ, obstacles };
}

function zoneCenterNear(x: number) {
  return (Math.round(x / ZONE_SPACING - 0.5) + 0.5) * ZONE_SPACING;
}

function aisleBeside(point: Point) {
  return point.x + COLUMN_OFFSET * (Math.sign(point.x - zoneCenterNear(point.x)) || 1);
}

// Walking around cauldrons instead of through them: out to the aisle, along the front corridor, then up to the new spot.
export function routeBetween(from: Point, to: Station): Point[] {
  return [
    { x: aisleBeside(from), z: from.z },
    { x: aisleBeside(from), z: FRONT_CORRIDOR_Z },
    { x: aisleBeside(to.spot), z: FRONT_CORRIDOR_Z },
    { x: aisleBeside(to.spot), z: to.spot.z },
    to.spot,
  ];
}

export function routeFromDoor(to: Station): Point[] {
  return [{ x: DOOR.x, z: FRONT_CORRIDOR_Z }, { x: aisleBeside(to.spot), z: FRONT_CORRIDOR_Z }, { x: aisleBeside(to.spot), z: to.spot.z }, to.spot];
}

export function hallBounds(backZ: number, clearance: number): Rect {
  return { minX: -HALL_HALF_WIDTH + clearance, maxX: HALL_HALF_WIDTH - clearance, minZ: backZ + clearance, maxZ: FRONT_EDGE_Z - clearance };
}
