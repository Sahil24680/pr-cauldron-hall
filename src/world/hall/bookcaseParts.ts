import * as THREE from "three";
import { HALL_HALF_WIDTH } from "../layout";
import { SPINE_VARIANTS, seededRandom } from "../textures";
import { CURIO_KINDS, CURIO_WIDTH, type CurioPieces, addCurio, emptyCurioPieces } from "./curios";
import { type Profile, lathe, merged, placed, woodBlock } from "./geometryKit";
import { BOTTLES, type BottleKind, LIQUIDS, type Potion } from "./potionParts";

export type BookcaseSpot = { z: number; side: number };
export type Book = { matrix: THREE.Matrix4; color: THREE.Color; variant: number };
export type SlidingBook = Book & { out: THREE.Vector3; phase: number };
export type Duster = { centre: THREE.Vector3; along: THREE.Vector3; yaw: number; phase: number };
export type FloatingBook = { at: THREE.Vector3; size: THREE.Vector3; turn: number; color: THREE.Color; variant: number };
const FRAME_MATERIALS = ["oak", "dark", "shadow", "brass", "runes", "shade", "seal"] as const;
type FrameMaterial = (typeof FRAME_MATERIALS)[number];
type FramePieces = Record<FrameMaterial, THREE.BufferGeometry[]>;
export type Bookcases = {
  frame: Record<FrameMaterial, THREE.BufferGeometry>;
  books: Book[];
  sliding: SlidingBook[];
  dusters: Duster[];
  floating: FloatingBook[];
  curios: CurioPieces;
  potions: Potion[];
};

const BOOKCASE = { width: 2.6, height: 2.3, depth: 0.5 };
const WALL_GAP = 0.02;
const POST_WIDTH = 0.1;
const INNER_WIDTH = BOOKCASE.width - POST_WIDTH * 2;
const SHELF_TOPS = [0.305, 1.005, 1.705];
const BOARD_THICKNESS = 0.05;
const ROW_CLEARANCE = 0.62;
const BOOK_FRONT_INSET = 0.04;
const BOOK_COLORS = ["#6b1f24", "#1f3b6b", "#2e5b3a", "#6b4a1f", "#4a2e6b", "#8a6a2a", "#2b2b2b", "#7a3b1f", "#3d5a5a", "#5a1f3d"];
const SHADE_SPREAD = 0.45;
const GAP_CHANCE = 0.07;
const STACK_CHANCE = 0.06;
const CURIO_CHANCE = 0.09;
const POTION_CHANCE = 0.05;
const LEAN_ANGLE = 0.3;
const FLOAT_OUT = 0.28;
const FLOAT_LIFT = 0.12;
const RUNE_STRIP_WIDTH = 0.055;
const RUNE_INSET = 0.002;
const SCALLOPS = 6;
const VALANCE_HEIGHT = 0.11;
const SMALL_POTIONS: BottleKind[] = ["vial", "flask", "cone", "square"];
const SMALL_POTION_SCALE = 0.85;
const FLOATER_EVERY = 2;
const FLOATER_ROW = 1;
const SLIDER_ROW = 1;
const SLIDE_OUT = 0.13;
const DUSTER_EVERY = 4;
const DUSTER_OFFSET = 2;
const DUSTER_HEIGHT = 0.42;
const DUSTER_OUT = 0.14;
const LADDER_EVERY = 4;
const LADDER_OFFSET = 1;
const LADDER = { x: 0.55, halfWidth: 0.21, footOut: 0.26, rungSpacing: 0.3 };
const BOOKEND_CHANCE = 0.35;
const BOOK_SIZES = [
  { thickness: [0.05, 0.06], height: [0.44, 0.16], depth: [0.26, 0.06] },
  { thickness: [0.035, 0.055], height: [0.3, 0.24], depth: [0.2, 0.1] },
  { thickness: [0.03, 0.045], height: [0.22, 0.2], depth: [0.17, 0.08] },
];
const SIDE_PANEL = { inset: 0.07, top: 0.35, bottom: 0.3, thickness: 0.016 };
const PEDIMENT = { reach: 0.62, rise: 0.3, gap: 0.26, thickness: 0.07, medallionY: 0.36, medallionRadius: 0.17 };

const FINIAL: Profile = [
  [0, 0],
  [0.035, 0.01],
  [0.04, 0.04],
  [0.02, 0.07],
  [0.028, 0.09],
  [0, 0.13],
];

function valanceShape() {
  const shape = new THREE.Shape();
  const half = INNER_WIDTH / 2;
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(half, -VALANCE_HEIGHT);
  const span = INNER_WIDTH / SCALLOPS;
  for (let scallop = SCALLOPS - 1; scallop >= 0; scallop--) {
    const left = -half + scallop * span;
    shape.quadraticCurveTo(left + span / 2, -VALANCE_HEIGHT * 0.25, left, -VALANCE_HEIGHT);
  }
  shape.closePath();
  return shape;
}

function emptyFrame(): FramePieces {
  return { oak: [], dark: [], shadow: [], brass: [], runes: [], shade: [], seal: [] };
}

function archedPanel(width: number, height: number) {
  const half = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(half, height - half);
  shape.absarc(0, height - half, half, 0, Math.PI, false);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: SIDE_PANEL.thickness, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 2 });
}

function buildFrame(): FramePieces {
  const { width, height, depth } = BOOKCASE;
  const oak: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  const shadow: THREE.BufferGeometry[] = [];
  const brass: THREE.BufferGeometry[] = [];
  const runes: THREE.BufferGeometry[] = [];
  const shade: THREE.BufferGeometry[] = [];
  const seal: THREE.BufferGeometry[] = [];
  const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
  const lip = (length: number, radius: number) => new THREE.CylinderGeometry(radius, radius, length, 10).rotateZ(Math.PI / 2);
  dark.push(placed(woodBlock(width + 0.08, 0.14, depth + 0.04), at(0, 0.07, 0.02)));
  dark.push(placed(lip(width + 0.1, 0.02), at(0, 0.15, depth / 2 + 0.04)));
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - POST_WIDTH / 2);
    oak.push(placed(woodBlock(POST_WIDTH, height, depth), at(x, height / 2, 0)));
    for (const edge of [-1, 1]) {
      const bead = new THREE.CylinderGeometry(0.011, 0.011, height - 0.3, 8);
      dark.push(placed(bead, at(x + edge * (POST_WIDTH / 2 - 0.012), height / 2, depth / 2 + 0.004)));
    }
    runes.push(placed(new THREE.PlaneGeometry(RUNE_STRIP_WIDTH, height - 0.5), at(x, height / 2, depth / 2 + RUNE_INSET)));
    brass.push(placed(lathe(FINIAL, 12), at(side * (width / 2 + 0.02), height + 0.13, depth / 2 - 0.02)));
  }
  shadow.push(placed(woodBlock(INNER_WIDTH, height - 0.2, 0.03), at(0, height / 2 + 0.05, -depth / 2 + 0.015)));
  for (const top of SHELF_TOPS) {
    oak.push(placed(woodBlock(INNER_WIDTH, BOARD_THICKNESS, depth - 0.04), at(0, top - BOARD_THICKNESS / 2, 0)));
    dark.push(placed(lip(INNER_WIDTH, 0.016), at(0, top - BOARD_THICKNESS / 2, depth / 2 - 0.02)));
  }
  oak.push(placed(woodBlock(width, 0.06, depth), at(0, height - 0.03, 0)));
  dark.push(placed(woodBlock(width + 0.1, 0.05, depth + 0.06), at(0, height + 0.025, 0.03)));
  oak.push(placed(woodBlock(width + 0.18, 0.06, depth + 0.1), at(0, height + 0.08, 0.05)));
  dark.push(placed(lip(width + 0.16, 0.026), at(0, height + 0.04, depth / 2 + 0.06)));
  const valance = new THREE.ExtrudeGeometry(valanceShape(), { depth: 0.025, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
  dark.push(placed(valance, at(0, height - 0.06, depth / 2 - 0.035)));
  const panel = archedPanel(depth - SIDE_PANEL.inset * 2, height - SIDE_PANEL.top - SIDE_PANEL.bottom);
  for (const side of [-1, 1]) {
    const facing = new THREE.Matrix4().makeRotationY(side * (Math.PI / 2));
    dark.push(placed(panel, at(side * (width / 2 - 0.004), SIDE_PANEL.bottom, 0).multiply(facing)));
    const slope = woodBlock(PEDIMENT.reach, PEDIMENT.thickness, 0.08);
    const angle = Math.atan2(PEDIMENT.rise, PEDIMENT.reach);
    const x = side * (PEDIMENT.gap / 2 + (PEDIMENT.reach * Math.cos(angle)) / 2);
    oak.push(placed(slope, at(x, height + 0.11 + PEDIMENT.rise / 2, depth / 2 + 0.04).multiply(new THREE.Matrix4().makeRotationZ(-side * angle))));
  }
  const medallion = at(0, height + PEDIMENT.medallionY, depth / 2 + 0.06);
  brass.push(placed(new THREE.TorusGeometry(PEDIMENT.medallionRadius, 0.022, 8, 32), medallion));
  seal.push(placed(new THREE.CircleGeometry(PEDIMENT.medallionRadius, 32), medallion));
  const compartments = [...SHELF_TOPS, height - 0.06];
  for (let row = 0; row < SHELF_TOPS.length; row++) {
    const floor = compartments[row] ?? 0;
    const ceiling = (compartments[row + 1] ?? height) - BOARD_THICKNESS;
    shade.push(placed(new THREE.PlaneGeometry(INNER_WIDTH, ceiling - floor), at(0, (floor + ceiling) / 2, -depth / 2 + 0.032)));
    brass.push(placed(woodBlock(0.12, 0.034, 0.008), at(0, floor - BOARD_THICKNESS / 2, depth / 2 - 0.002)));
  }
  return { oak, dark, shadow, brass, runes, shade, seal };
}

function buildLadder(): Pick<FramePieces, "oak" | "brass"> {
  const { height, depth } = BOOKCASE;
  const foot = new THREE.Vector3(LADDER.x, 0, depth / 2 + LADDER.footOut);
  const head = new THREE.Vector3(LADDER.x, height - 0.02, depth / 2 + 0.07);
  const length = foot.distanceTo(head);
  const lean = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), head.clone().sub(foot).normalize());
  const oak: THREE.BufferGeometry[] = [];
  const brass: THREE.BufferGeometry[] = [];
  for (const edge of [-1, 1]) {
    const rail = new THREE.Matrix4().compose(
      foot
        .clone()
        .lerp(head, 0.5)
        .setX(LADDER.x + edge * LADDER.halfWidth),
      lean,
      new THREE.Vector3(1, 1, 1),
    );
    oak.push(placed(woodBlock(0.045, length, 0.03), rail));
    const hook = new THREE.TorusGeometry(0.03, 0.007, 6, 12, Math.PI);
    brass.push(
      placed(
        hook,
        new THREE.Matrix4().compose(
          head.clone().setX(LADDER.x + edge * LADDER.halfWidth),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)),
          new THREE.Vector3(1, 1, 1),
        ),
      ),
    );
  }
  const rung = new THREE.CylinderGeometry(0.014, 0.014, LADDER.halfWidth * 2, 8).rotateZ(Math.PI / 2);
  for (let along = LADDER.rungSpacing; along < length - 0.1; along += LADDER.rungSpacing) {
    oak.push(placed(rung, new THREE.Matrix4().makeTranslation(foot.clone().lerp(head, along / length))));
  }
  brass.push(
    placed(new THREE.CylinderGeometry(0.012, 0.012, BOOKCASE.width - 0.3, 8).rotateZ(Math.PI / 2), new THREE.Matrix4().makeTranslation(0, head.y, head.z)),
  );
  return { oak, brass };
}

function shadeOf(random: () => number) {
  const base = new THREE.Color(BOOK_COLORS[Math.floor(random() * BOOK_COLORS.length)] ?? "#6b1f24");
  return base.multiplyScalar(1 - SHADE_SPREAD / 2 + random() * SHADE_SPREAD);
}

class ShelfFiller {
  readonly books: Book[] = [];
  readonly sliding: SlidingBook[] = [];
  readonly dusters: Duster[] = [];
  readonly floating: FloatingBook[] = [];
  readonly curios = emptyCurioPieces();
  readonly potions: Potion[] = [];

  private world = new THREE.Matrix4();
  private yaw = 0;
  private row = 0;
  private wantsSlider = false;

  constructor(private readonly random: () => number) {}

  fillBookcase(world: THREE.Matrix4, yaw: number, wantsFloater: boolean, wantsDuster: boolean) {
    this.world = world;
    this.yaw = yaw;
    this.wantsSlider = true;
    SHELF_TOPS.forEach((floor, row) => {
      this.row = row;
      this.fill(floor, wantsFloater && row === FLOATER_ROW);
    });
    if (wantsDuster) {
      const top = SHELF_TOPS[SHELF_TOPS.length - 1] ?? 0;
      const centre = new THREE.Vector3(0, top + DUSTER_HEIGHT, BOOKCASE.depth / 2 + DUSTER_OUT).applyMatrix4(world);
      const along = new THREE.Vector3(1, 0, 0).transformDirection(world);
      this.dusters.push({ centre, along, yaw, phase: this.random() * Math.PI * 2 });
    }
  }

  private local(x: number, y: number, z: number, rotation = new THREE.Euler(), scale = new THREE.Vector3(1, 1, 1)) {
    return this.world.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(rotation), scale));
  }

  private bookSize() {
    const random = this.random;
    const sizes = BOOK_SIZES[this.row] ?? BOOK_SIZES[1];
    const pick = (range: number[] | undefined) => (range?.[0] ?? 0.1) + random() * (range?.[1] ?? 0);
    return new THREE.Vector3(pick(sizes?.thickness), Math.min(ROW_CLEARANCE, pick(sizes?.height)), pick(sizes?.depth));
  }

  private standing(cursor: number, floor: number, size: THREE.Vector3, lean: number) {
    const z = BOOKCASE.depth / 2 - BOOK_FRONT_INSET - size.z / 2;
    const lift = (size.y / 2) * Math.cos(lean) + (size.x / 2) * Math.abs(Math.sin(lean));
    const shift = -(size.y / 2) * Math.sin(lean);
    const matrix = this.local(cursor + size.x / 2 + shift, floor + lift, z, new THREE.Euler(0, 0, lean), size);
    const book = { matrix, color: shadeOf(this.random), variant: Math.floor(this.random() * SPINE_VARIANTS) };
    if (this.wantsSlider && this.row === SLIDER_ROW && lean === 0 && cursor > 0) {
      this.wantsSlider = false;
      this.sliding.push({ ...book, out: new THREE.Vector3(0, 0, 1).transformDirection(this.world).multiplyScalar(SLIDE_OUT), phase: this.random() * 10 });
      return;
    }
    this.books.push(book);
  }

  private stack(cursor: number, floor: number) {
    const random = this.random;
    const count = 2 + Math.floor(random() * 3);
    let width = 0;
    let y = floor;
    for (let index = 0; index < count; index++) {
      const size = this.bookSize();
      const lying = new THREE.Vector3(size.y * 0.75, size.x, size.z);
      width = Math.max(width, lying.x);
      const matrix = this.local(
        cursor + lying.x / 2 + (random() - 0.5) * 0.02,
        y + lying.y / 2,
        BOOKCASE.depth / 2 - BOOK_FRONT_INSET - size.z / 2,
        new THREE.Euler(0, (random() - 0.5) * 0.15, 0),
        lying,
      );
      this.books.push({ matrix, color: shadeOf(random), variant: Math.floor(random() * SPINE_VARIANTS) });
      y += lying.y;
    }
    return width;
  }

  private bookend(cursor: number, floor: number) {
    const plate = woodBlock(0.012, 0.16, 0.12);
    const base = woodBlock(0.1, 0.008, 0.12);
    const z = BOOKCASE.depth / 2 - BOOK_FRONT_INSET - 0.08;
    this.curios.brass.push(placed(plate, this.local(cursor + 0.006, floor + 0.08, z)), placed(base, this.local(cursor + 0.05, floor + 0.004, z)));
    return 0.014;
  }

  private smallPotions(cursor: number, floor: number) {
    const random = this.random;
    const count = 2 + Math.floor(random() * 2);
    let used = 0;
    for (let index = 0; index < count; index++) {
      const kind = SMALL_POTIONS[(index + Math.floor(random() * SMALL_POTIONS.length)) % SMALL_POTIONS.length] ?? "vial";
      const half = BOTTLES[kind].footprint * SMALL_POTION_SCALE;
      const at = new THREE.Vector3(cursor + used + half, floor, (random() - 0.5) * 0.12).applyMatrix4(this.world);
      this.potions.push({
        kind,
        at,
        yaw: this.yaw + random() * Math.PI * 2,
        lean: 0,
        scale: SMALL_POTION_SCALE,
        liquid: LIQUIDS[Math.floor(random() * LIQUIDS.length)] ?? "emerald",
        fill: 0.3 + random() * 0.5,
        stopper: random() > 0.5 ? "cork" : "wax",
        label: null,
        dust: random() * 0.6,
        lying: false,
      });
      used += half * 2 + 0.015;
    }
    return used;
  }

  private fill(floor: number, wantsFloater: boolean) {
    const random = this.random;
    const end = INNER_WIDTH / 2 - 0.02;
    let cursor = -end;
    let floaterPlaced = !wantsFloater;
    let leanNext = 0;
    if (random() < BOOKEND_CHANCE) {
      cursor += this.bookend(cursor, floor);
    }
    while (cursor < end - 0.1) {
      const roll = random();
      if (roll < GAP_CHANCE) {
        const gap = 0.06 + random() * 0.12;
        const size = this.bookSize();
        if (!floaterPlaced && gap > size.x) {
          floaterPlaced = true;
          const at = new THREE.Vector3(cursor + gap / 2, floor + size.y / 2 + FLOAT_LIFT, BOOKCASE.depth / 2 + FLOAT_OUT).applyMatrix4(this.world);
          this.floating.push({ at, size, turn: this.yaw, color: shadeOf(random), variant: Math.floor(random() * SPINE_VARIANTS) });
        }
        cursor += gap;
        leanNext = random() > 0.4 ? -LEAN_ANGLE * (0.5 + random() * 0.5) : 0;
        continue;
      }
      if (roll < GAP_CHANCE + STACK_CHANCE) {
        cursor += this.stack(cursor, floor) + 0.01;
        continue;
      }
      if (roll < GAP_CHANCE + STACK_CHANCE + CURIO_CHANCE) {
        const kind = CURIO_KINDS[Math.floor(random() * CURIO_KINDS.length)] ?? "scrolls";
        const width = CURIO_WIDTH[kind];
        if (cursor + width < end) {
          addCurio(kind, this.curios, this.local(cursor + width / 2, floor, 0.04), random);
        }
        cursor += width;
        continue;
      }
      if (roll < GAP_CHANCE + STACK_CHANCE + CURIO_CHANCE + POTION_CHANCE) {
        cursor += this.smallPotions(cursor, floor) + 0.01;
        continue;
      }
      const size = this.bookSize();
      if (cursor + size.x > end) {
        break;
      }
      this.standing(cursor, floor, size, leanNext);
      cursor += size.x + (leanNext === 0 ? 0.004 : size.y * Math.abs(Math.sin(leanNext)));
      leanNext = 0;
    }
  }
}

export function buildBookcases(spots: BookcaseSpot[], seed: number): Bookcases {
  const shared = buildFrame();
  const ladder = buildLadder();
  const frame = emptyFrame();
  const filler = new ShelfFiller(seededRandom(seed));
  spots.forEach((spot, index) => {
    const yaw = spot.side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const world = new THREE.Matrix4().compose(
      new THREE.Vector3(spot.side * (HALL_HALF_WIDTH - BOOKCASE.depth / 2 - WALL_GAP), 0, spot.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
      new THREE.Vector3(1, 1, 1),
    );
    for (const material of FRAME_MATERIALS) {
      frame[material].push(...shared[material].map((piece) => piece.clone().applyMatrix4(world)));
    }
    if (index % LADDER_EVERY === LADDER_OFFSET) {
      frame.oak.push(...ladder.oak.map((piece) => piece.clone().applyMatrix4(world)));
      frame.brass.push(...ladder.brass.map((piece) => piece.clone().applyMatrix4(world)));
    }
    filler.fillBookcase(world, yaw, index % FLOATER_EVERY === 0, index % DUSTER_EVERY === DUSTER_OFFSET);
  });
  return {
    frame: {
      oak: merged(frame.oak),
      dark: merged(frame.dark),
      shadow: merged(frame.shadow),
      brass: merged(frame.brass),
      runes: merged(frame.runes),
      shade: merged(frame.shade),
      seal: merged(frame.seal),
    },
    books: filler.books,
    sliding: filler.sliding,
    dusters: filler.dusters,
    floating: filler.floating,
    curios: filler.curios,
    potions: filler.potions,
  };
}
