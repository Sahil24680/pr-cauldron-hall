import * as THREE from "three";
import { drawRune, paintCanvas, softDot, starPath, toTexture } from "../textures";

export const PAINTING_ASPECT = 0.8;
const PAINTING_WIDTH = 1024;
const PAINTING_HEIGHT = PAINTING_WIDTH / PAINTING_ASPECT;
const HORIZON = 0.62;
const PAINTING_STARS = 320;
const BRUSH_STROKES = 2600;
const CASTLE_WINDOWS = 18;
const CLOUD_WIDTH = 1024;
const CLOUD_HEIGHT = 512;
const CLOUD_PUFFS = 70;
const PAINTING_MOON = { u: 0.7, v: 0.2 };
export const PAINTING_STAFF_TIP = { u: 0.31, v: 0.6 };

type Point = [number, number];

function ridge(context: CanvasRenderingContext2D, base: number, height: number, roughness: number, random: () => number, fill: string | CanvasGradient) {
  context.beginPath();
  context.moveTo(0, PAINTING_HEIGHT);
  let y = base;
  for (let x = 0; x <= PAINTING_WIDTH; x += 16) {
    y = THREE.MathUtils.clamp(y + (random() - 0.5) * roughness, base - height, base + height * 0.3);
    context.lineTo(x, y);
  }
  context.lineTo(PAINTING_WIDTH, PAINTING_HEIGHT);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}

function shape(context: CanvasRenderingContext2D, points: Point[], fill: string) {
  context.beginPath();
  for (const [x, y] of points) {
    context.lineTo(x * PAINTING_WIDTH, y * PAINTING_HEIGHT);
  }
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}

function paintCastle(context: CanvasRenderingContext2D, random: () => number) {
  const towers: [number, number, number][] = [
    [0.66, 0.4, 0.035],
    [0.72, 0.34, 0.03],
    [0.78, 0.38, 0.04],
    [0.85, 0.43, 0.028],
  ];
  shape(
    context,
    [
      [0.62, 0.52],
      [0.62, 0.44],
      [0.9, 0.46],
      [0.9, 0.52],
    ],
    "#141634",
  );
  for (const [x, top, half] of towers) {
    shape(
      context,
      [
        [x - half, 0.5],
        [x - half, top],
        [x, top - 0.06],
        [x + half, top],
        [x + half, 0.5],
      ],
      "#111330",
    );
  }
  for (let window = 0; window < CASTLE_WINDOWS; window++) {
    const tower = towers[window % towers.length] ?? [0.7, 0.4, 0.03];
    const x = (tower[0] + (random() - 0.5) * tower[2]) * PAINTING_WIDTH;
    const y = (tower[1] + 0.02 + random() * 0.08) * PAINTING_HEIGHT;
    softDot(context, x, y, 14, "rgba(255,190,90,0.35)");
    context.fillStyle = "#ffd58a";
    context.fillRect(x - 2, y - 4, 4, 7);
  }
}

function paintWizard(context: CanvasRenderingContext2D) {
  const tip: Point = [PAINTING_STAFF_TIP.u * PAINTING_WIDTH, PAINTING_STAFF_TIP.v * PAINTING_HEIGHT];
  softDot(context, tip[0], tip[1], 220, "rgba(120,220,255,0.18)");
  softDot(context, tip[0], tip[1], 80, "rgba(200,245,255,0.6)");
  shape(
    context,
    [
      [0.17, 0.86],
      [0.21, 0.74],
      [0.225, 0.69],
      [0.215, 0.64],
      [0.235, 0.6],
      [0.25, 0.64],
      [0.245, 0.69],
      [0.27, 0.74],
      [0.3, 0.86],
    ],
    "#0a0a1c",
  );
  shape(
    context,
    [
      [0.225, 0.615],
      [0.24, 0.53],
      [0.255, 0.615],
    ],
    "#0a0a1c",
  );
  shape(
    context,
    [
      [0.245, 0.68],
      [0.3, 0.62],
      [0.305, 0.635],
      [0.255, 0.7],
    ],
    "#0a0a1c",
  );
  context.strokeStyle = "#1a1208";
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(0.33 * PAINTING_WIDTH, 0.84 * PAINTING_HEIGHT);
  context.lineTo(tip[0], tip[1]);
  context.stroke();
  context.strokeStyle = "rgba(170,200,255,0.75)";
  context.lineWidth = 2.5;
  context.beginPath();
  context.moveTo(0.27 * PAINTING_WIDTH, 0.74 * PAINTING_HEIGHT);
  context.lineTo(0.25 * PAINTING_WIDTH, 0.64 * PAINTING_HEIGHT);
  context.lineTo(0.24 * PAINTING_WIDTH, 0.53 * PAINTING_HEIGHT);
  context.stroke();
  softDot(context, tip[0], tip[1], 26, "rgba(255,255,255,1)");
}

// A moonlit keep on a cliff and a robed wizard raising a lit staff, painted in layers from far to near.
export function paintingCanvas() {
  return paintCanvas(PAINTING_WIDTH, PAINTING_HEIGHT, 211, (context, random) => {
    const sky = context.createLinearGradient(0, 0, 0, PAINTING_HEIGHT * HORIZON);
    sky.addColorStop(0, "#080c26");
    sky.addColorStop(0.45, "#1d2a62");
    sky.addColorStop(0.85, "#4a3f84");
    sky.addColorStop(1, "#a07894");
    context.fillStyle = sky;
    context.fillRect(0, 0, PAINTING_WIDTH, PAINTING_HEIGHT);
    for (let star = 0; star < PAINTING_STARS; star++) {
      const bright = random() > 0.93;
      context.fillStyle = `rgba(255,250,235,${0.3 + random() * 0.6})`;
      const x = random() * PAINTING_WIDTH;
      const y = random() * PAINTING_HEIGHT * 0.5;
      context.fillRect(x, y, bright ? 3 : 1.5, bright ? 3 : 1.5);
      if (bright) {
        softDot(context, x, y, 10, "rgba(220,230,255,0.4)");
      }
    }
    const moon: Point = [PAINTING_MOON.u * PAINTING_WIDTH, PAINTING_MOON.v * PAINTING_HEIGHT];
    softDot(context, moon[0], moon[1], 420, "rgba(150,170,255,0.18)");
    softDot(context, moon[0], moon[1], 170, "rgba(220,225,255,0.35)");
    const disc = context.createRadialGradient(moon[0] - 20, moon[1] - 20, 10, moon[0], moon[1], 72);
    disc.addColorStop(0, "#fffbe8");
    disc.addColorStop(1, "#d8d2b8");
    context.fillStyle = disc;
    context.beginPath();
    context.arc(moon[0], moon[1], 72, 0, Math.PI * 2);
    context.fill();
    for (let crater = 0; crater < 7; crater++) {
      softDot(context, moon[0] + (random() - 0.5) * 90, moon[1] + (random() - 0.5) * 90, 8 + random() * 14, "rgba(150,140,120,0.35)");
    }
    ridge(context, PAINTING_HEIGHT * 0.56, 110, 60, random, "#3c4378");
    softDot(context, PAINTING_WIDTH * 0.5, PAINTING_HEIGHT * 0.6, 500, "rgba(200,200,255,0.08)");
    ridge(context, PAINTING_HEIGHT * 0.62, 80, 46, random, "#272b5a");
    shape(
      context,
      [
        [0.55, 1],
        [0.58, 0.6],
        [0.64, 0.52],
        [0.92, 0.5],
        [1, 0.56],
        [1, 1],
      ],
      "#1b1d42",
    );
    paintCastle(context, random);
    const mist = context.createLinearGradient(0, PAINTING_HEIGHT * 0.66, 0, PAINTING_HEIGHT * 0.78);
    mist.addColorStop(0, "rgba(180,190,240,0)");
    mist.addColorStop(0.5, "rgba(180,190,240,0.22)");
    mist.addColorStop(1, "rgba(180,190,240,0)");
    context.fillStyle = mist;
    context.fillRect(0, PAINTING_HEIGHT * 0.66, PAINTING_WIDTH, PAINTING_HEIGHT * 0.12);
    shape(
      context,
      [
        [0, 1],
        [0, 0.8],
        [0.12, 0.84],
        [0.2, 0.85],
        [0.34, 0.84],
        [0.44, 0.9],
        [0.5, 1],
      ],
      "#0b0b1e",
    );
    context.strokeStyle = "rgba(150,180,255,0.55)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0.12 * PAINTING_WIDTH, 0.84 * PAINTING_HEIGHT);
    context.lineTo(0.2 * PAINTING_WIDTH, 0.85 * PAINTING_HEIGHT);
    context.lineTo(0.34 * PAINTING_WIDTH, 0.84 * PAINTING_HEIGHT);
    context.lineTo(0.44 * PAINTING_WIDTH, 0.9 * PAINTING_HEIGHT);
    context.stroke();
    paintWizard(context);
    for (let stroke = 0; stroke < BRUSH_STROKES; stroke++) {
      const x = random() * PAINTING_WIDTH;
      const y = random() * PAINTING_HEIGHT;
      const angle = random() * Math.PI;
      const length = 6 + random() * 18;
      context.strokeStyle = random() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)";
      context.lineWidth = 1 + random() * 3;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      context.stroke();
    }
    const vignette = context.createRadialGradient(
      PAINTING_WIDTH / 2,
      PAINTING_HEIGHT / 2,
      PAINTING_WIDTH * 0.35,
      PAINTING_WIDTH / 2,
      PAINTING_HEIGHT / 2,
      PAINTING_HEIGHT * 0.75,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.5)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, PAINTING_WIDTH, PAINTING_HEIGHT);
  });
}

// Seamless across x so the layer can scroll forever over the painted sky.
export function cloudCanvas() {
  return paintCanvas(CLOUD_WIDTH, CLOUD_HEIGHT, 223, (context, random) => {
    for (let puff = 0; puff < CLOUD_PUFFS; puff++) {
      const x = random() * CLOUD_WIDTH;
      const y = CLOUD_HEIGHT * (0.25 + random() * 0.5);
      const radius = 40 + random() * 90;
      for (const wrap of [-CLOUD_WIDTH, 0, CLOUD_WIDTH]) {
        context.save();
        context.translate(x + wrap, y);
        context.scale(2.4, 0.6);
        softDot(context, 0, 0, radius, `rgba(200,205,240,${0.08 + random() * 0.08})`);
        context.restore();
      }
    }
  });
}

const SKETCH_WIDTH = 512;
const SKETCH_HEIGHT = 384;
const SKETCH_HATCHES = 90;

export function sketchTexture() {
  const canvas = paintCanvas(SKETCH_WIDTH, SKETCH_HEIGHT, 233, (context, random) => {
    context.fillStyle = "#e6d6ae";
    context.fillRect(0, 0, SKETCH_WIDTH, SKETCH_HEIGHT);
    for (let stain = 0; stain < 9; stain++) {
      softDot(context, random() * SKETCH_WIDTH, random() * SKETCH_HEIGHT, 30 + random() * 70, "rgba(120,80,30,0.12)");
    }
    context.strokeStyle = "rgba(60,36,18,0.85)";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(40, 300);
    context.quadraticCurveTo(250, 270, 470, 310);
    context.stroke();
    context.lineWidth = 2.5;
    context.beginPath();
    context.ellipse(256, 210, 62, 82, 0, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(256, 112, 48, 0, Math.PI * 2);
    context.stroke();
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(256 + side * 30, 75);
      context.lineTo(256 + side * 44, 52);
      context.lineTo(256 + side * 18, 70);
      context.stroke();
      context.beginPath();
      context.arc(256 + side * 20, 110, 15, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = "rgba(60,36,18,0.85)";
      context.beginPath();
      context.arc(256 + side * 20, 110, 5, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(256 + side * 55, 170);
      context.quadraticCurveTo(256 + side * 80, 230, 256 + side * 40, 285);
      context.stroke();
    }
    context.beginPath();
    context.moveTo(250, 125);
    context.lineTo(256, 138);
    context.lineTo(262, 125);
    context.stroke();
    context.lineWidth = 1;
    for (let hatch = 0; hatch < SKETCH_HATCHES; hatch++) {
      const y = 150 + random() * 120;
      const x = 256 + (random() - 0.5) * 90;
      context.beginPath();
      context.moveTo(x - 6, y);
      context.lineTo(x + 4, y + 7);
      context.stroke();
    }
  });
  return toTexture(canvas, true);
}

const TAPESTRY_WIDTH = 512;
const TAPESTRY_HEIGHT = 1024;
const FRINGE = 48;
const BORDER = 36;
const THREADS = 3000;

// Midnight wool with a gold lozenge border, the Keep's seal at its heart and a loose fringe (cut out by alpha).
export function tapestryTexture() {
  const canvas = paintCanvas(TAPESTRY_WIDTH, TAPESTRY_HEIGHT, 241, (context, random) => {
    const bottom = TAPESTRY_HEIGHT - FRINGE;
    context.fillStyle = "#c9a24a";
    context.fillRect(0, 0, TAPESTRY_WIDTH, bottom);
    context.fillStyle = "#5a1f2a";
    context.fillRect(BORDER * 0.5, BORDER * 0.5, TAPESTRY_WIDTH - BORDER, bottom - BORDER);
    context.fillStyle = "#1a2446";
    context.fillRect(BORDER, BORDER, TAPESTRY_WIDTH - BORDER * 2, bottom - BORDER * 2);
    context.strokeStyle = "rgba(90,110,170,0.35)";
    context.lineWidth = 2;
    for (let y = BORDER + 40; y < bottom - BORDER; y += 80) {
      for (let x = BORDER + 40; x < TAPESTRY_WIDTH - BORDER; x += 80) {
        context.beginPath();
        context.moveTo(x, y - 26);
        context.lineTo(x + 18, y);
        context.lineTo(x, y + 26);
        context.lineTo(x - 18, y);
        context.closePath();
        context.stroke();
      }
    }
    context.fillStyle = "#5a1f2a";
    for (let y = 18; y < bottom; y += 36) {
      for (const x of [BORDER * 0.25, TAPESTRY_WIDTH - BORDER * 0.25]) {
        context.beginPath();
        context.arc(x, y, 5, 0, Math.PI * 2);
        context.fill();
      }
    }
    const centre: Point = [TAPESTRY_WIDTH / 2, bottom * 0.45];
    softDot(context, centre[0], centre[1], 200, "rgba(201,162,74,0.15)");
    context.strokeStyle = "#c9a24a";
    context.lineWidth = 12;
    context.beginPath();
    context.arc(centre[0], centre[1], 150, 0, Math.PI * 2);
    context.stroke();
    context.lineWidth = 4;
    context.beginPath();
    context.arc(centre[0], centre[1], 122, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#e0c066";
    starPath(context, centre[0], centre[1], 112, 26);
    context.fill();
    context.fillStyle = "#c9a24a";
    context.beginPath();
    context.arc(centre[0] + 34, centre[1] - 60, 26, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#1a2446";
    context.beginPath();
    context.arc(centre[0] + 44, centre[1] - 66, 22, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#c9a24a";
    context.lineWidth = 4;
    for (let rune = 0; rune < 5; rune++) {
      drawRune(context, TAPESTRY_WIDTH * (0.25 + rune * 0.125), bottom * 0.82, 40, random);
    }
    for (let thread = 0; thread < THREADS; thread++) {
      context.fillStyle = random() > 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
      context.fillRect(random() * TAPESTRY_WIDTH, random() * bottom, 1, 4);
    }
    context.fillStyle = "#b8923e";
    for (let x = 2; x < TAPESTRY_WIDTH; x += 6) {
      context.fillRect(x, bottom, 3, FRINGE * (0.6 + random() * 0.4));
    }
  });
  return toTexture(canvas, true);
}

export type SigilMark = "open" | "eye" | "broken" | "star";
const SIGIL_SIZE = 256;

// White line art for a stage sigil; the material tints and glows it in the stage colour.
export function sigilTexture(mark: SigilMark) {
  const canvas = paintCanvas(SIGIL_SIZE, SIGIL_SIZE, 251, (context, random) => {
    const centre = SIGIL_SIZE / 2;
    context.strokeStyle = "#ffffff";
    context.fillStyle = "#ffffff";
    context.lineCap = "round";
    context.shadowColor = "#ffffff";
    context.shadowBlur = 10;
    context.lineWidth = 6;
    context.beginPath();
    context.arc(centre, centre, SIGIL_SIZE * 0.44, 0, Math.PI * 2);
    context.stroke();
    context.lineWidth = 3;
    for (let rune = 0; rune < 10; rune++) {
      const angle = (rune / 10) * Math.PI * 2;
      drawRune(context, centre + Math.cos(angle) * SIGIL_SIZE * 0.37, centre + Math.sin(angle) * SIGIL_SIZE * 0.37, SIGIL_SIZE * 0.06, random);
    }
    context.lineWidth = 5;
    if (mark === "open") {
      context.beginPath();
      context.arc(centre, centre, SIGIL_SIZE * 0.16, 0.3, Math.PI * 2 - 0.3);
      context.stroke();
    } else if (mark === "eye") {
      context.beginPath();
      context.moveTo(centre - SIGIL_SIZE * 0.22, centre);
      context.quadraticCurveTo(centre, centre - SIGIL_SIZE * 0.2, centre + SIGIL_SIZE * 0.22, centre);
      context.quadraticCurveTo(centre, centre + SIGIL_SIZE * 0.2, centre - SIGIL_SIZE * 0.22, centre);
      context.stroke();
      context.beginPath();
      context.arc(centre, centre, SIGIL_SIZE * 0.05, 0, Math.PI * 2);
      context.fill();
    } else if (mark === "broken") {
      context.beginPath();
      context.arc(centre, centre, SIGIL_SIZE * 0.17, 0.6, Math.PI - 0.6);
      context.stroke();
      context.beginPath();
      context.arc(centre, centre, SIGIL_SIZE * 0.17, Math.PI + 0.6, Math.PI * 2 - 0.6);
      context.stroke();
      context.beginPath();
      context.moveTo(centre - SIGIL_SIZE * 0.24, centre + SIGIL_SIZE * 0.1);
      context.lineTo(centre + SIGIL_SIZE * 0.24, centre - SIGIL_SIZE * 0.1);
      context.stroke();
    } else {
      starPath(context, centre, centre, SIGIL_SIZE * 0.22, SIGIL_SIZE * 0.06);
      context.fill();
    }
  });
  return toTexture(canvas, false);
}

const INLAY_SIZE = 1024;
const INLAY_RUNES = 24;
const INLAY_POINTS = 8;

// The entrance floor seal in two stones with brass lines: an eight-point compass inside a ring of carved runes.
export function entranceInlay() {
  const canvas = paintCanvas(INLAY_SIZE, INLAY_SIZE, 263, (context, random) => {
    const centre = INLAY_SIZE / 2;
    const ring = (radius: number, color: string, width: number) => {
      context.strokeStyle = color;
      context.lineWidth = width;
      context.beginPath();
      context.arc(centre, centre, radius, 0, Math.PI * 2);
      context.stroke();
    };
    context.fillStyle = "#3d3833";
    context.beginPath();
    context.arc(centre, centre, INLAY_SIZE * 0.49, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#8a7f73";
    context.beginPath();
    context.arc(centre, centre, INLAY_SIZE * 0.38, 0, Math.PI * 2);
    context.fill();
    for (let point = 0; point < INLAY_POINTS * 2; point++) {
      const angle = (point / (INLAY_POINTS * 2)) * Math.PI * 2;
      const reach = point % 2 === 0 ? INLAY_SIZE * 0.36 : INLAY_SIZE * 0.22;
      const next = angle + Math.PI / INLAY_POINTS;
      context.fillStyle = point % 4 < 2 ? "#4f4740" : "#6d645b";
      context.beginPath();
      context.moveTo(centre, centre);
      context.lineTo(centre + Math.cos(angle) * reach, centre + Math.sin(angle) * reach);
      context.lineTo(centre + Math.cos(next) * INLAY_SIZE * 0.1, centre + Math.sin(next) * INLAY_SIZE * 0.1);
      context.closePath();
      context.fill();
    }
    ring(INLAY_SIZE * 0.49, "#c9a24a", 8);
    ring(INLAY_SIZE * 0.38, "#c9a24a", 6);
    ring(INLAY_SIZE * 0.1, "#c9a24a", 5);
    context.strokeStyle = "#9a9080";
    context.lineWidth = 6;
    for (let rune = 0; rune < INLAY_RUNES; rune++) {
      const angle = (rune / INLAY_RUNES) * Math.PI * 2;
      drawRune(context, centre + Math.cos(angle) * INLAY_SIZE * 0.435, centre + Math.sin(angle) * INLAY_SIZE * 0.435, INLAY_SIZE * 0.05, random);
    }
    context.fillStyle = "#c9a24a";
    starPath(context, centre, centre, INLAY_SIZE * 0.08, INLAY_SIZE * 0.02);
    context.fill();
    for (let scuff = 0; scuff < 400; scuff++) {
      context.fillStyle = random() > 0.5 ? "rgba(255,240,220,0.05)" : "rgba(0,0,0,0.08)";
      context.fillRect(random() * INLAY_SIZE, random() * INLAY_SIZE, 2 + random() * 6, 1 + random() * 2);
    }
  });
  return toTexture(canvas, true);
}

const BARK_SIZE = 256;
const BARK_FURROWS = 70;

export function barkTexture() {
  const canvas = paintCanvas(BARK_SIZE, BARK_SIZE, 271, (context, random) => {
    context.fillStyle = "#3b2818";
    context.fillRect(0, 0, BARK_SIZE, BARK_SIZE);
    for (let furrow = 0; furrow < BARK_FURROWS; furrow++) {
      context.strokeStyle = random() > 0.5 ? "rgba(15,8,4,0.7)" : "rgba(110,80,50,0.35)";
      context.lineWidth = 1 + random() * 3;
      let x = random() * BARK_SIZE;
      context.beginPath();
      context.moveTo(x, 0);
      for (let y = 0; y <= BARK_SIZE; y += 16) {
        x += (random() - 0.5) * 8;
        context.lineTo(x, y);
      }
      context.stroke();
    }
  });
  return toTexture(canvas, true);
}

export const SKY_PANEL_VARIANTS = 4;
const SKY_PANEL_PIXELS = 512;
const SKY_PANEL_STARS = 140;
const SKY_GILT_STARS = 3;

// Painted coffer panels: a navy night with faint stars, a few gilt stars and a thin gold constellation, one variant per atlas column.
export function skyPanels() {
  const canvas = paintCanvas(SKY_PANEL_PIXELS * SKY_PANEL_VARIANTS, SKY_PANEL_PIXELS, 307, (context, random) => {
    for (let variant = 0; variant < SKY_PANEL_VARIANTS; variant++) {
      const left = variant * SKY_PANEL_PIXELS;
      const depth = context.createRadialGradient(
        left + SKY_PANEL_PIXELS / 2,
        SKY_PANEL_PIXELS / 2,
        20,
        left + SKY_PANEL_PIXELS / 2,
        SKY_PANEL_PIXELS / 2,
        SKY_PANEL_PIXELS * 0.75,
      );
      depth.addColorStop(0, "#1c2a5c");
      depth.addColorStop(1, "#0b1230");
      context.fillStyle = depth;
      context.fillRect(left, 0, SKY_PANEL_PIXELS, SKY_PANEL_PIXELS);
      softDot(context, left + random() * SKY_PANEL_PIXELS, random() * SKY_PANEL_PIXELS, 160, "rgba(120,90,180,0.12)");
      for (let star = 0; star < SKY_PANEL_STARS; star++) {
        context.fillStyle = `rgba(255,248,225,${0.25 + random() * 0.55})`;
        const size = random() > 0.9 ? 2.5 : 1.3;
        context.fillRect(left + random() * SKY_PANEL_PIXELS, random() * SKY_PANEL_PIXELS, size, size);
      }
      const constellation: [number, number][] = Array.from({ length: 5 }, () => [
        left + 80 + random() * (SKY_PANEL_PIXELS - 160),
        80 + random() * (SKY_PANEL_PIXELS - 160),
      ]);
      context.strokeStyle = "rgba(224,176,74,0.45)";
      context.lineWidth = 1.5;
      context.beginPath();
      for (const [x, y] of constellation) {
        context.lineTo(x, y);
      }
      context.stroke();
      for (const [x, y] of constellation) {
        softDot(context, x, y, 10, "rgba(255,230,160,0.8)");
      }
      context.fillStyle = "#e0b04a";
      for (let gilt = 0; gilt < SKY_GILT_STARS; gilt++) {
        const x = left + 50 + random() * (SKY_PANEL_PIXELS - 100);
        const y = 50 + random() * (SKY_PANEL_PIXELS - 100);
        starPath(context, x, y, 16 + random() * 10, 4, 8);
        context.fill();
      }
      context.strokeStyle = "#c9a24a";
      context.lineWidth = 6;
      context.strokeRect(left + 10, 10, SKY_PANEL_PIXELS - 20, SKY_PANEL_PIXELS - 20);
      context.lineWidth = 2;
      context.strokeRect(left + 24, 24, SKY_PANEL_PIXELS - 48, SKY_PANEL_PIXELS - 48);
    }
  });
  return toTexture(canvas, true);
}

const ROSE_PIXELS = 512;
const ROSE_PETALS = 12;
const ROSE_GLASS = ["#2a4fb0", "#4a2f9a", "#1f6aa8", "#6a3fb0"];

// Leaded glass in a twelve-petal rose: lead lines are dark, panes are moonlit blues and violets with a gold heart.
export function roseWindow() {
  const canvas = paintCanvas(ROSE_PIXELS, ROSE_PIXELS, 311, (context, random) => {
    const centre = ROSE_PIXELS / 2;
    const outer = ROSE_PIXELS * 0.48;
    context.fillStyle = "#101320";
    context.fillRect(0, 0, ROSE_PIXELS, ROSE_PIXELS);
    for (let petal = 0; petal < ROSE_PETALS; petal++) {
      const start = (petal / ROSE_PETALS) * Math.PI * 2;
      const end = start + (Math.PI * 2) / ROSE_PETALS;
      for (const [inner, reach] of [
        [outer * 0.22, outer * 0.6],
        [outer * 0.6, outer],
      ] as const) {
        context.fillStyle = ROSE_GLASS[(petal + (reach === outer ? 1 : 0)) % ROSE_GLASS.length] ?? "#2a4fb0";
        context.beginPath();
        context.arc(centre, centre, reach, start + 0.02, end - 0.02);
        context.arc(centre, centre, inner, end - 0.02, start + 0.02, true);
        context.closePath();
        context.fill();
        softDot(
          context,
          centre + Math.cos((start + end) / 2) * (inner + reach) * 0.5,
          centre + Math.sin((start + end) / 2) * (inner + reach) * 0.5,
          30,
          `rgba(200,220,255,${0.15 + random() * 0.2})`,
        );
      }
    }
    context.fillStyle = "#e0b04a";
    context.beginPath();
    context.arc(centre, centre, outer * 0.2, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#0a0a10";
    context.lineWidth = 7;
    for (const radius of [outer * 0.2, outer * 0.6, outer]) {
      context.beginPath();
      context.arc(centre, centre, radius, 0, Math.PI * 2);
      context.stroke();
    }
    for (let spoke = 0; spoke < ROSE_PETALS; spoke++) {
      const angle = (spoke / ROSE_PETALS) * Math.PI * 2;
      context.beginPath();
      context.moveTo(centre + Math.cos(angle) * outer * 0.2, centre + Math.sin(angle) * outer * 0.2);
      context.lineTo(centre + Math.cos(angle) * outer, centre + Math.sin(angle) * outer);
      context.stroke();
    }
  });
  return toTexture(canvas, true);
}
