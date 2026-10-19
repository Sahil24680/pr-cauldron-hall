import type { Appearance } from "../../../../shared/cast";

// The stage motif the palettes still carry; robes now follow each character's own pattern.
export type Motif = "moons" | "stars" | "runes" | "leaves";
export type RobePattern = Appearance["pattern"];

type Context = CanvasRenderingContext2D;

const STAR_POINTS = 5;
const STAR_INNER = 0.42;
const SPARKLE_INNER = 0.22;
const FULL_TURN = Math.PI * 2;

export function star(context: Context, x: number, y: number, radius: number, points = STAR_POINTS, inner = STAR_INNER) {
  context.beginPath();
  for (let point = 0; point < points * 2; point++) {
    const angle = (point / (points * 2)) * FULL_TURN - Math.PI / 2;
    const reach = point % 2 === 0 ? radius : radius * inner;
    context.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  context.closePath();
  context.fill();
}

export function sparkle(context: Context, x: number, y: number, radius: number) {
  star(context, x, y, radius, 4, SPARKLE_INNER);
}

export function ring(context: Context, x: number, y: number, radius: number) {
  context.beginPath();
  context.arc(x, y, radius, 0, FULL_TURN);
  context.stroke();
}

export function dot(context: Context, x: number, y: number, radius: number) {
  context.beginPath();
  context.arc(x, y, radius, 0, FULL_TURN);
  context.fill();
}

// A crescent cut with the destination-out operation, so it works over any background, even a gradient.
export function crescent(context: Context, x: number, y: number, radius: number, facing = 1) {
  const size = Math.ceil(radius * 2 + 4);
  const centre = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const cut = canvas.getContext("2d");
  if (!cut) {
    return;
  }
  cut.fillStyle = context.fillStyle;
  cut.beginPath();
  cut.arc(centre, centre, radius, 0, FULL_TURN);
  cut.fill();
  cut.globalCompositeOperation = "destination-out";
  cut.beginPath();
  cut.arc(centre + facing * radius * 0.45, centre - radius * 0.2, radius * 0.85, 0, FULL_TURN);
  cut.fill();
  context.drawImage(canvas, x - centre, y - centre);
}

// One moon of a phase cycle: 0 is new, 0.5 full. The lit part is bounded by the limb and an elliptical terminator;
// the unlit disc keeps a thin outline so a new moon still shows.
export function moonPhase(context: Context, x: number, y: number, radius: number, phase: number) {
  context.lineWidth = Math.max(1, radius * 0.12);
  ring(context, x, y, radius);
  const waxing = phase <= 0.5;
  const terminator = Math.abs(Math.cos(phase * FULL_TURN)) * radius;
  const gibbous = Math.abs(phase - 0.5) < 0.25;
  context.save();
  context.translate(x, y);
  context.scale(waxing ? 1 : -1, 1);
  context.beginPath();
  context.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
  context.ellipse(0, 0, terminator, radius, 0, Math.PI / 2, gibbous ? Math.PI * 1.5 : -Math.PI / 2, !gibbous);
  context.fill();
  context.restore();
}

// Original rune set: strokes hung on a stem, readable at a glance and not any real alphabet. Coordinates are in
// units of the rune's half height.
const RUNE_STROKES: [number, number, number, number][][] = [
  [
    [0, -0.4, 0.6, -0.9],
    [0, 0.2, -0.6, -0.3],
  ],
  [
    [0, -0.9, 0.6, -0.2],
    [0.6, -0.2, 0, 0.4],
  ],
  [
    [-0.5, 0, 0.5, 0],
    [0, 0.6, 0.55, 0.95],
  ],
  [
    [0, -0.2, -0.6, 0.4],
    [0, -0.2, 0.6, 0.4],
  ],
  [
    [0, -1, 0.55, -0.5],
    [0, -0.4, 0.55, 0.1],
  ],
  [
    [-0.55, -0.6, 0.55, 0.6],
    [0.55, -0.6, -0.55, 0.6],
  ],
  [
    [0, -0.1, 0.55, -0.6],
    [0, -0.1, 0.55, 0.4],
  ],
  [
    [0, -1, -0.55, -0.45],
    [0, -1, 0.55, -0.45],
  ],
  [
    [0, 0.2, 0.6, -0.4],
    [0.6, -0.4, 0.6, 0.6],
  ],
  [
    [-0.55, -0.3, 0.55, -0.3],
    [-0.55, 0.3, 0.55, 0.3],
  ],
  [
    [0, -0.6, 0.5, -0.2],
    [0.5, -0.2, 0, 0.2],
    [0, 0.2, 0.5, 0.6],
  ],
  [
    [0, 1, -0.55, 0.45],
    [0, 1, 0.55, 0.45],
    [-0.4, -0.5, 0.4, -0.5],
  ],
];

export function rune(context: Context, x: number, y: number, size: number, variant: number) {
  context.lineWidth = Math.max(1.5, size * 0.2);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(x, y - size);
  context.lineTo(x, y + size);
  for (const [x1, y1, x2, y2] of RUNE_STROKES[variant % RUNE_STROKES.length] ?? []) {
    context.moveTo(x + x1 * size, y + y1 * size);
    context.lineTo(x + x2 * size, y + y2 * size);
  }
  context.stroke();
}

export function triangle(context: Context, x: number, y: number, radius: number, pointing: 1 | -1) {
  context.beginPath();
  for (let corner = 0; corner < 3; corner++) {
    const angle = -pointing * (Math.PI / 2) + (corner / 3) * FULL_TURN;
    context.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  context.closePath();
  context.stroke();
}

function line(context: Context, x1: number, y1: number, x2: number, y2: number) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

function cross(context: Context, x: number, y: number, size: number) {
  line(context, x, y - size, x, y + size);
  line(context, x - size * 0.7, y, x + size * 0.7, y);
}

// Alchemical signs drawn in strokes of the current style, centred on (x, y) and about `size` from centre to edge.
export const ALCHEMY_SIGNS = ["sun", "moon", "mercury", "sulfur", "salt", "fire", "water", "air", "earth"] as const;
export type AlchemySign = (typeof ALCHEMY_SIGNS)[number];

export function alchemySign(context: Context, sign: AlchemySign, x: number, y: number, size: number) {
  context.lineWidth = Math.max(1.5, size * 0.14);
  context.lineCap = "round";
  if (sign === "sun") {
    ring(context, x, y, size * 0.75);
    dot(context, x, y, size * 0.18);
  } else if (sign === "moon") {
    crescent(context, x, y, size * 0.8, -1);
  } else if (sign === "mercury") {
    ring(context, x, y - size * 0.05, size * 0.38);
    context.beginPath();
    context.arc(x, y - size * 0.62, size * 0.32, 0, Math.PI);
    context.stroke();
    cross(context, x, y + size * 0.62, size * 0.3);
  } else if (sign === "sulfur") {
    triangle(context, x, y - size * 0.3, size * 0.55, 1);
    cross(context, x, y + size * 0.55, size * 0.38);
  } else if (sign === "salt") {
    ring(context, x, y, size * 0.75);
    line(context, x - size * 0.75, y, x + size * 0.75, y);
  } else {
    const pointing = sign === "fire" || sign === "air" ? 1 : -1;
    triangle(context, x, y, size * 0.8, pointing);
    if (sign === "air" || sign === "earth") {
      line(context, x - size * 0.55, y + pointing * size * 0.05, x + size * 0.55, y + pointing * size * 0.05);
    }
  }
}

export function leaf(context: Context, x: number, y: number, size: number, angle: number) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.beginPath();
  context.moveTo(0, -size);
  context.quadraticCurveTo(size * 0.7, 0, 0, size);
  context.quadraticCurveTo(-size * 0.7, 0, 0, -size);
  context.fill();
  context.restore();
}

export function flower(context: Context, x: number, y: number, size: number, petals = 5) {
  for (let petal = 0; petal < petals; petal++) {
    const angle = (petal / petals) * FULL_TURN;
    leaf(context, x + Math.sin(angle) * size * 0.55, y - Math.cos(angle) * size * 0.55, size * 0.5, angle);
  }
  dot(context, x, y, size * 0.22);
}

// A spiral tendril: the filigree that links motifs along an embroidered band.
export function swirl(context: Context, x: number, y: number, size: number, direction: number) {
  context.lineCap = "round";
  context.beginPath();
  const turns = 1.6;
  const steps = 28;
  for (let step = 0; step <= steps; step++) {
    const along = step / steps;
    const angle = along * turns * FULL_TURN;
    const reach = size * (1 - along * 0.85);
    context.lineTo(x + direction * Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  context.stroke();
}

export function diamond(context: Context, x: number, y: number, halfWidth: number, halfHeight: number) {
  context.beginPath();
  context.moveTo(x, y - halfHeight);
  context.lineTo(x + halfWidth, y);
  context.lineTo(x, y + halfHeight);
  context.lineTo(x - halfWidth, y);
  context.closePath();
}

// The damask palmette: a tall central leaf over two pairs of curling side leaves and a scrolled base, filled.
// `size` is the height from base to tip.
export function palmette(context: Context, x: number, y: number, size: number) {
  const half = size / 2;
  context.save();
  context.translate(x, y);
  context.beginPath();
  context.moveTo(0, -half);
  context.bezierCurveTo(size * 0.2, -half * 0.5, size * 0.16, half * 0.2, 0, half * 0.45);
  context.bezierCurveTo(-size * 0.16, half * 0.2, -size * 0.2, -half * 0.5, 0, -half);
  context.fill();
  for (const side of [-1, 1]) {
    context.beginPath();
    context.moveTo(side * size * 0.04, half * 0.35);
    context.bezierCurveTo(side * size * 0.45, half * 0.3, side * size * 0.5, -half * 0.35, side * size * 0.3, -half * 0.55);
    context.bezierCurveTo(side * size * 0.36, -half * 0.2, side * size * 0.24, half * 0.05, side * size * 0.04, half * 0.15);
    context.fill();
    context.beginPath();
    context.moveTo(side * size * 0.04, half * 0.6);
    context.bezierCurveTo(side * size * 0.32, half * 0.75, side * size * 0.48, half * 0.45, side * size * 0.4, half * 0.25);
    context.bezierCurveTo(side * size * 0.32, half * 0.42, side * size * 0.2, half * 0.55, side * size * 0.04, half * 0.48);
    context.fill();
  }
  context.beginPath();
  context.ellipse(0, half * 0.7, size * 0.1, size * 0.07, 0, 0, FULL_TURN);
  context.fill();
  context.restore();
}

// A four-petalled rosette where the damask lattice crosses.
export function rosette(context: Context, x: number, y: number, size: number) {
  for (let petal = 0; petal < 4; petal++) {
    leaf(context, x + Math.sin((petal * Math.PI) / 2) * size * 0.5, y - Math.cos((petal * Math.PI) / 2) * size * 0.5, size * 0.5, (petal * Math.PI) / 2);
  }
  dot(context, x, y, size * 0.2);
}

// The centrepiece of each pattern's embroidered medallions on bands and borders; `index` varies it between repeats.
export function medallionGlyph(context: Context, pattern: RobePattern, x: number, y: number, size: number, index: number) {
  if (pattern === "celestial") {
    if (index % 2 === 0) {
      crescent(context, x, y, size * 0.8, 1);
    } else {
      star(context, x, y, size * 0.85);
    }
  } else if (pattern === "runic") {
    context.lineWidth = Math.max(1.5, size * 0.12);
    diamond(context, x, y, size, size);
    context.stroke();
    rune(context, x, y, size * 0.5, index * 5 + 1);
  } else if (pattern === "alchemy") {
    context.lineWidth = Math.max(1.5, size * 0.1);
    ring(context, x, y, size);
    alchemySign(context, ALCHEMY_SIGNS[index % ALCHEMY_SIGNS.length] ?? "sun", x, y, size * 0.6);
  } else if (pattern === "herbal") {
    flower(context, x, y, size * 0.85);
  } else if (pattern === "damask") {
    palmette(context, x, y, size * 1.8);
  } else {
    diamond(context, x, y, size * 0.45, size * 0.7);
    context.fill();
  }
}
