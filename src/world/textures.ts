import * as THREE from "three";

export type StoneKind = "wall" | "floor";
export type SurfaceTextures = { map: THREE.CanvasTexture; bump: THREE.CanvasTexture };

const TEXTURE_SIZE = 1024;
// rows pairs each course's share of the tile height with how many stones it is cut into, so floors can mix wide and narrow courses.
type StoneRecipe = {
  rows: { share: number; columns: number; offset: number }[];
  mortar: number;
  shades: [number, number, number][];
  spread: number;
  crackChance: number;
  wornPatches: number;
};
const RECIPES: Record<StoneKind, StoneRecipe> = {
  wall: {
    rows: Array.from({ length: 8 }, (_, row) => ({ share: 1 / 8, columns: 4, offset: row % 2 === 0 ? 0 : 0.5 })),
    mortar: 10,
    shades: [
      [104, 94, 84],
      [88, 82, 76],
      [116, 104, 88],
    ],
    spread: 14,
    crackChance: 0.18,
    wornPatches: 0,
  },
  floor: {
    rows: [
      { share: 0.3, columns: 3, offset: 0 },
      { share: 0.14, columns: 6, offset: 0.25 },
      { share: 0.22, columns: 4, offset: 0.6 },
      { share: 0.14, columns: 6, offset: 0.1 },
      { share: 0.2, columns: 3, offset: 0.45 },
    ],
    mortar: 9,
    shades: [
      [80, 74, 68],
      [68, 64, 62],
      [92, 84, 74],
    ],
    spread: 12,
    crackChance: 0.3,
    wornPatches: 26,
  },
};
const BEVEL = 10;
const CHIPS_PER_BLOCK = 2;

export function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function paintCrack(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, random: () => number) {
  let pointX = x + random() * width;
  let pointY = y + random() * height * 0.3;
  context.beginPath();
  context.moveTo(pointX, pointY);
  for (let step = 0; step < 6; step++) {
    pointX += (random() - 0.5) * width * 0.25;
    pointY += height * (0.08 + random() * 0.12);
    context.lineTo(pointX, pointY);
  }
  context.stroke();
}

// Dressed stone: a few shades per kind, bevelled edges and chipped corners in the bump, the odd hairline crack.
function paintStone(kind: StoneKind, forBump: boolean) {
  const recipe = RECIPES[kind];
  return paintCanvas(TEXTURE_SIZE, TEXTURE_SIZE, kind === "wall" ? 7 : 13, (context, random) => {
    context.fillStyle = forBump ? "#000" : "#24201c";
    context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    let top = 0;
    for (const course of recipe.rows) {
      const blockHeight = TEXTURE_SIZE * course.share;
      const blockWidth = TEXTURE_SIZE / course.columns;
      const offset = blockWidth * course.offset;
      const y = top + recipe.mortar / 2;
      top += blockHeight;
      for (let column = -1; column <= course.columns; column++) {
        const x = column * blockWidth + offset + recipe.mortar / 2;
        const width = blockWidth - recipe.mortar;
        const height = blockHeight - recipe.mortar;
        const [r, g, b] = recipe.shades[Math.floor(random() * recipe.shades.length)] ?? [90, 84, 78];
        const shade = (random() - 0.5) * recipe.spread;
        if (forBump) {
          context.fillStyle = "rgb(150,150,150)";
          context.fillRect(x, y, width, height);
          context.fillStyle = `rgb(${205 + shade},${205 + shade},${205 + shade})`;
          context.fillRect(x + BEVEL, y + BEVEL, width - BEVEL * 2, height - BEVEL * 2);
        } else {
          const face = context.createLinearGradient(x, y, x + width, y + height);
          face.addColorStop(0, `rgb(${r + shade + 8},${g + shade + 8},${b + shade + 6})`);
          face.addColorStop(1, `rgb(${r + shade - 10},${g + shade - 10},${b + shade - 8})`);
          context.fillStyle = face;
          context.fillRect(x, y, width, height);
          context.fillStyle = "rgba(255,236,210,0.05)";
          context.fillRect(x, y, width, 3);
        }
        context.fillStyle = forBump ? "#202020" : "rgba(20,16,12,0.6)";
        for (let chip = 0; chip < CHIPS_PER_BLOCK; chip++) {
          const cornerX = random() > 0.5 ? x : x + width;
          const cornerY = random() > 0.5 ? y : y + height;
          const size = 4 + random() * 10;
          context.beginPath();
          context.moveTo(cornerX, cornerY);
          context.lineTo(cornerX + (cornerX === x ? size : -size), cornerY);
          context.lineTo(cornerX, cornerY + (cornerY === y ? size : -size));
          context.fill();
        }
        if (random() < recipe.crackChance) {
          context.strokeStyle = forBump ? "rgba(0,0,0,0.7)" : "rgba(18,14,10,0.55)";
          context.lineWidth = 1.2;
          paintCrack(context, x, y, width, height, random);
        }
      }
    }
    if (!forBump) {
      for (let patch = 0; patch < recipe.wornPatches; patch++) {
        softDot(context, random() * TEXTURE_SIZE, random() * TEXTURE_SIZE, 60 + random() * 140, "rgba(255,240,215,0.05)");
      }
    }
    const speckles = forBump ? 6000 : 22000;
    for (let index = 0; index < speckles; index++) {
      const light = random() > 0.5;
      context.fillStyle = forBump ? (light ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.18)") : light ? "rgba(255,240,220,0.05)" : "rgba(0,0,0,0.09)";
      const size = 1 + random() * 3;
      context.fillRect(random() * TEXTURE_SIZE, random() * TEXTURE_SIZE, size, size);
    }
  });
}

export function toTexture(canvas: HTMLCanvasElement, color: boolean) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  if (color) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
}

const cache = new Map<StoneKind, { map: HTMLCanvasElement; bump: HTMLCanvasElement }>();

export function stoneTextures(kind: StoneKind, repeatX: number, repeatY: number): SurfaceTextures {
  const painted = cache.get(kind) ?? { map: paintStone(kind, false), bump: paintStone(kind, true) };
  cache.set(kind, painted);
  const map = toTexture(painted.map, true);
  const bump = toTexture(painted.bump, false);
  map.repeat.set(repeatX, repeatY);
  bump.repeat.set(repeatX, repeatY);
  return { map, bump };
}

export function featherTexture(base: string, edge: string, speckle: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = base;
    context.fillRect(0, 0, 128, 128);
    const random = seededRandom(31);
    for (let row = 0; row < 12; row++) {
      for (let column = 0; column < 9; column++) {
        const x = column * 16 + (row % 2) * 8;
        const y = row * 11;
        context.strokeStyle = edge;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(x, y, 8, 0.15 * Math.PI, 0.85 * Math.PI);
        context.stroke();
        if (random() > 0.55) {
          context.fillStyle = speckle;
          context.beginPath();
          context.ellipse(x + 1, y + 4, 1.6, 2.4, 0, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
  }
  return toTexture(canvas, true);
}

type Painter = (context: CanvasRenderingContext2D, random: () => number) => void;

export function paintCanvas(width: number, height: number, seed: number, paint: Painter) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) {
    paint(context, seededRandom(seed));
  }
  return canvas;
}

export function softDot(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

const ENVIRONMENT_WIDTH = 512;
const ENVIRONMENT_HEIGHT = 256;
const ENVIRONMENT_CANDLES = 70;
const ENVIRONMENT_WINDOWS = 6;

let environment: THREE.CanvasTexture | null = null;

// Metals and crystals need something to reflect; this stands in for the candlelit hall around them.
export function hallReflections() {
  if (environment) {
    return environment;
  }
  const canvas = paintCanvas(ENVIRONMENT_WIDTH, ENVIRONMENT_HEIGHT, 41, (context, random) => {
    const sky = context.createLinearGradient(0, 0, 0, ENVIRONMENT_HEIGHT);
    sky.addColorStop(0, "#1b2546");
    sky.addColorStop(0.45, "#3a2a1e");
    sky.addColorStop(0.55, "#2a1c12");
    sky.addColorStop(1, "#0d0906");
    context.fillStyle = sky;
    context.fillRect(0, 0, ENVIRONMENT_WIDTH, ENVIRONMENT_HEIGHT);
    for (let index = 0; index < ENVIRONMENT_WINDOWS; index++) {
      const x = (index + 0.5) * (ENVIRONMENT_WIDTH / ENVIRONMENT_WINDOWS);
      softDot(context, x, ENVIRONMENT_HEIGHT * 0.38, 26, "rgba(120,150,255,0.55)");
    }
    for (let index = 0; index < ENVIRONMENT_CANDLES; index++) {
      const x = random() * ENVIRONMENT_WIDTH;
      const y = ENVIRONMENT_HEIGHT * (0.12 + random() * 0.4);
      const warm = random() > 0.2;
      softDot(context, x, y, 4 + random() * 10, warm ? "rgba(255,210,140,1)" : "rgba(200,170,255,0.9)");
      softDot(context, x, y, 1.5, "rgba(255,255,255,1)");
    }
  });
  environment = toTexture(canvas, true);
  environment.mapping = THREE.EquirectangularReflectionMapping;
  return environment;
}

const SPARKLE_POINTS = 160;
let sparkleEnvironment: THREE.CanvasTexture | null = null;

// Mostly black with pin-point lights, so flat crystal facets either flash or stay clear as the view moves.
export function crystalReflections() {
  if (sparkleEnvironment) {
    return sparkleEnvironment;
  }
  const canvas = paintCanvas(ENVIRONMENT_WIDTH, ENVIRONMENT_HEIGHT, 77, (context, random) => {
    context.fillStyle = "#050407";
    context.fillRect(0, 0, ENVIRONMENT_WIDTH, ENVIRONMENT_HEIGHT);
    for (let index = 0; index < SPARKLE_POINTS; index++) {
      const x = random() * ENVIRONMENT_WIDTH;
      const y = ENVIRONMENT_HEIGHT * (0.05 + random() * 0.9);
      softDot(context, x, y, 3 + random() * 7, random() > 0.3 ? "rgba(255,236,200,1)" : "rgba(190,210,255,1)");
    }
  });
  sparkleEnvironment = toTexture(canvas, true);
  sparkleEnvironment.mapping = THREE.EquirectangularReflectionMapping;
  return sparkleEnvironment;
}

const CAUSTIC_WIDTH = 1024;
const CAUSTIC_HEIGHT = 256;
const CAUSTIC_SPOTS = 140;
const CAUSTIC_HUES = [200, 270, 330, 45, 180];
let caustics: THREE.CanvasTexture | null = null;

// Scattered rainbow flecks a crystal chandelier throws onto nearby stone.
export function crystalCaustics() {
  if (caustics) {
    return caustics;
  }
  const canvas = paintCanvas(CAUSTIC_WIDTH, CAUSTIC_HEIGHT, 59, (context, random) => {
    for (let index = 0; index < CAUSTIC_SPOTS; index++) {
      const hue = CAUSTIC_HUES[index % CAUSTIC_HUES.length] ?? 200;
      const x = random() * CAUSTIC_WIDTH;
      const y = CAUSTIC_HEIGHT * (0.15 + random() * 0.7);
      const radius = 3 + random() * 9;
      context.save();
      context.translate(x, y);
      context.rotate(random() * Math.PI);
      context.scale(1, 0.35 + random() * 0.65);
      softDot(context, 0, 0, radius, `hsla(${hue},90%,82%,${0.35 + random() * 0.5})`);
      context.restore();
    }
  });
  caustics = toTexture(canvas, true);
  return caustics;
}

const GLOW_SIZE = 64;
let radial: THREE.CanvasTexture | null = null;

export function radialGlow() {
  if (radial) {
    return radial;
  }
  const canvas = paintCanvas(GLOW_SIZE, GLOW_SIZE, 1, (context) => {
    softDot(context, GLOW_SIZE / 2, GLOW_SIZE / 2, GLOW_SIZE / 2, "rgba(255,255,255,1)");
  });
  radial = toTexture(canvas, false);
  return radial;
}

export const LABEL_COLUMNS = 4;
export const LABEL_ROWS = 2;
const LABEL_CELL_WIDTH = 128;
const LABEL_CELL_HEIGHT = 64;
const LABEL_MARGIN = 6;
let labels: THREE.CanvasTexture | null = null;

export function drawRune(context: CanvasRenderingContext2D, x: number, y: number, size: number, random: () => number) {
  context.beginPath();
  context.moveTo(x, y - size / 2);
  context.lineTo(x, y + size / 2);
  const strokes = 1 + Math.floor(random() * 3);
  for (let stroke = 0; stroke < strokes; stroke++) {
    const from = y - size / 2 + random() * size;
    const reach = (random() > 0.5 ? 1 : -1) * size * (0.25 + random() * 0.3);
    if (random() > 0.5) {
      context.moveTo(x, from);
      context.lineTo(x + reach, from + (random() - 0.5) * size * 0.6);
    } else {
      context.moveTo(x + reach, from);
      context.arc(x, from, Math.abs(reach), 0, Math.PI * (0.5 + random()));
    }
  }
  context.stroke();
  if (random() > 0.6) {
    context.fillRect(x + size * 0.3, y - size / 2, 2, 2);
  }
}

// An atlas of little parchment labels inked with made-up runes, LABEL_COLUMNS by LABEL_ROWS cells.
export function potionLabels() {
  if (labels) {
    return labels;
  }
  const width = LABEL_CELL_WIDTH * LABEL_COLUMNS;
  const height = LABEL_CELL_HEIGHT * LABEL_ROWS;
  const canvas = paintCanvas(width, height, 23, (context, random) => {
    for (let row = 0; row < LABEL_ROWS; row++) {
      for (let column = 0; column < LABEL_COLUMNS; column++) {
        const left = column * LABEL_CELL_WIDTH;
        const top = row * LABEL_CELL_HEIGHT;
        const tone = 200 + Math.floor(random() * 30);
        context.fillStyle = `rgb(${tone},${tone - 22},${tone - 70})`;
        context.fillRect(left, top, LABEL_CELL_WIDTH, LABEL_CELL_HEIGHT);
        for (let stain = 0; stain < 5; stain++) {
          softDot(context, left + random() * LABEL_CELL_WIDTH, top + random() * LABEL_CELL_HEIGHT, 8 + random() * 18, "rgba(110,70,30,0.18)");
        }
        context.strokeStyle = "rgba(60,36,18,0.85)";
        context.fillStyle = "rgba(60,36,18,0.85)";
        context.lineWidth = 2;
        context.strokeRect(left + LABEL_MARGIN, top + LABEL_MARGIN, LABEL_CELL_WIDTH - LABEL_MARGIN * 2, LABEL_CELL_HEIGHT - LABEL_MARGIN * 2);
        const runes = 3 + Math.floor(random() * 3);
        const spacing = (LABEL_CELL_WIDTH - LABEL_MARGIN * 6) / runes;
        for (let rune = 0; rune < runes; rune++) {
          drawRune(context, left + LABEL_MARGIN * 3 + spacing * (rune + 0.5), top + LABEL_CELL_HEIGHT / 2, 24, random);
        }
      }
    }
  });
  labels = toTexture(canvas, true);
  return labels;
}

const WOOD_SIZE = 512;
const WOOD_GRAIN_LINES = 90;
const WOOD_KNOTS = 4;
let woodCanvases: { map: HTMLCanvasElement; bump: HTMLCanvasElement } | null = null;

function paintWood(forBump: boolean) {
  return paintCanvas(WOOD_SIZE, WOOD_SIZE, 61, (context, random) => {
    context.fillStyle = forBump ? "#808080" : "#8a6a4a";
    context.fillRect(0, 0, WOOD_SIZE, WOOD_SIZE);
    for (let line = 0; line < WOOD_GRAIN_LINES; line++) {
      const y = random() * WOOD_SIZE;
      const wave = 2 + random() * 6;
      const frequency = 0.004 + random() * 0.01;
      const dark = random();
      context.strokeStyle = forBump ? `rgba(0,0,0,${0.15 + dark * 0.3})` : `rgba(40,22,10,${0.12 + dark * 0.3})`;
      context.lineWidth = 0.6 + random() * 2.4;
      context.beginPath();
      for (let x = 0; x <= WOOD_SIZE; x += 8) {
        const offset = Math.sin(x * frequency + line) * wave;
        if (x === 0) {
          context.moveTo(x, y + offset);
        } else {
          context.lineTo(x, y + offset);
        }
      }
      context.stroke();
    }
    for (let knot = 0; knot < WOOD_KNOTS; knot++) {
      const x = random() * WOOD_SIZE;
      const y = random() * WOOD_SIZE;
      for (let ring = 5; ring > 0; ring--) {
        context.strokeStyle = forBump ? "rgba(0,0,0,0.25)" : "rgba(35,18,8,0.35)";
        context.lineWidth = 1.2;
        context.beginPath();
        context.ellipse(x, y, ring * 5, ring * 2, 0, 0, Math.PI * 2);
        context.stroke();
      }
    }
  });
}

export function woodTextures(repeatX: number, repeatY: number): SurfaceTextures {
  woodCanvases = woodCanvases ?? { map: paintWood(false), bump: paintWood(true) };
  const map = toTexture(woodCanvases.map, true);
  const bump = toTexture(woodCanvases.bump, false);
  map.repeat.set(repeatX, repeatY);
  bump.repeat.set(repeatX, repeatY);
  return { map, bump };
}

export const SPINE_VARIANTS = 8;
const SPINE_WIDTH = 64;
const SPINE_HEIGHT = 256;
const SPINE_WEAR_SPECKS = 220;
type SpineDecoration = "lines" | "lozenge" | "title" | "stars";
const SPINE_DECORATIONS: SpineDecoration[] = ["lines", "lozenge", "title", "stars"];
let spines: THREE.CanvasTexture | null = null;

function raisedBand(context: CanvasRenderingContext2D, left: number, y: number, height: number) {
  const band = context.createLinearGradient(0, y, 0, y + height);
  band.addColorStop(0, "rgba(255,0,0,1)");
  band.addColorStop(0.5, "rgba(90,0,0,1)");
  band.addColorStop(1, "rgba(255,0,0,1)");
  context.fillStyle = band;
  context.fillRect(left, y, SPINE_WIDTH, height);
}

function gildSpine(context: CanvasRenderingContext2D, decoration: SpineDecoration, left: number, top: number, bottom: number, random: () => number) {
  const middle = left + SPINE_WIDTH / 2;
  const centre = (top + bottom) / 2;
  context.fillStyle = "#00ff00";
  context.strokeStyle = "#00ff00";
  context.lineWidth = 2;
  if (decoration === "lozenge") {
    context.beginPath();
    context.moveTo(middle, centre - 22);
    context.lineTo(middle + 14, centre);
    context.lineTo(middle, centre + 22);
    context.lineTo(middle - 14, centre);
    context.closePath();
    context.stroke();
    context.fillRect(middle - 2, centre - 2, 4, 4);
  } else if (decoration === "title") {
    context.strokeRect(left + 12, centre - 18, SPINE_WIDTH - 24, 36);
    for (let mark = 0; mark < 3; mark++) {
      context.fillRect(left + 18 + random() * 6, centre - 10 + mark * 9, SPINE_WIDTH - 40 - random() * 10, 3);
    }
  } else if (decoration === "stars") {
    for (let star = 0; star < 3; star++) {
      const y = top + ((star + 1) / 4) * (bottom - top);
      context.fillRect(middle - 1, y - 6, 2, 12);
      context.fillRect(middle - 6, y - 1, 12, 2);
    }
  } else {
    for (let mark = 0; mark < 5; mark++) {
      context.fillRect(left + SPINE_WIDTH * (0.3 + random() * 0.15), top + 12 + mark * 9, SPINE_WIDTH * (0.15 + random() * 0.25), 3);
    }
  }
}

// Channel masks, not colours: red darkens leather (raised bands shade round), green marks gilt, blue marks worn edges.
export function bookSpines() {
  if (spines) {
    return spines;
  }
  const canvas = paintCanvas(SPINE_WIDTH * SPINE_VARIANTS, SPINE_HEIGHT, 83, (context, random) => {
    context.fillStyle = "#000";
    context.fillRect(0, 0, SPINE_WIDTH * SPINE_VARIANTS, SPINE_HEIGHT);
    context.globalCompositeOperation = "lighter";
    for (let variant = 0; variant < SPINE_VARIANTS; variant++) {
      const left = variant * SPINE_WIDTH;
      const bands = 2 + (variant % 4);
      const bandHeight = 9 + (variant % 3) * 3;
      const bandY = (band: number) => SPINE_HEIGHT * (0.07 + (band / bands) * 0.86);
      for (let band = 0; band <= bands; band++) {
        raisedBand(context, left, bandY(band), bandHeight);
      }
      context.fillStyle = "#00ff00";
      for (let band = 0; band <= bands; band++) {
        context.fillRect(left, bandY(band) - 4, SPINE_WIDTH, 2);
        context.fillRect(left, bandY(band) + bandHeight + 2, SPINE_WIDTH, 2);
      }
      const panel = 1 + Math.floor(random() * Math.max(1, bands - 1));
      gildSpine(context, SPINE_DECORATIONS[variant % SPINE_DECORATIONS.length] ?? "lines", left, bandY(panel - 1) + bandHeight + 4, bandY(panel) - 4, random);
      context.fillStyle = "#0000ff";
      for (let speck = 0; speck < SPINE_WEAR_SPECKS; speck++) {
        const edge = random() > 0.5;
        const x = edge ? left + (random() > 0.5 ? random() * 6 : SPINE_WIDTH - random() * 6) : left + random() * SPINE_WIDTH;
        const y = edge ? random() * SPINE_HEIGHT : random() > 0.5 ? random() * 8 : SPINE_HEIGHT - random() * 8;
        context.fillRect(x, y, 2, 2);
      }
    }
  });
  spines = toTexture(canvas, false);
  return spines;
}

const SHADE_SIZE = 128;
let compartment: THREE.CanvasTexture | null = null;

// Alpha for the shadow that pools at the back of a shelf: darkest under the shelf above and in the corners.
export function compartmentShade() {
  if (compartment) {
    return compartment;
  }
  const canvas = paintCanvas(SHADE_SIZE, SHADE_SIZE, 1, (context) => {
    const fromTop = context.createLinearGradient(0, 0, 0, SHADE_SIZE);
    fromTop.addColorStop(0, "rgba(255,255,255,1)");
    fromTop.addColorStop(0.6, "rgba(120,120,120,1)");
    fromTop.addColorStop(1, "rgba(60,60,60,1)");
    context.fillStyle = fromTop;
    context.fillRect(0, 0, SHADE_SIZE, SHADE_SIZE);
    for (const x of [0, SHADE_SIZE]) {
      const side = context.createLinearGradient(x, 0, SHADE_SIZE / 2, 0);
      side.addColorStop(0, "rgba(255,255,255,0.8)");
      side.addColorStop(0.4, "rgba(255,255,255,0)");
      context.fillStyle = side;
      context.fillRect(0, 0, SHADE_SIZE, SHADE_SIZE);
    }
  });
  compartment = toTexture(canvas, false);
  compartment.wrapS = THREE.ClampToEdgeWrapping;
  compartment.wrapT = THREE.ClampToEdgeWrapping;
  return compartment;
}

const SEAL_SIZE = 256;
let seal: THREE.CanvasTexture | null = null;

export function starPath(context: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, points = 4) {
  context.beginPath();
  for (let point = 0; point < points * 2; point++) {
    const angle = (point / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const reach = point % 2 === 0 ? outer : inner;
    context.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  context.closePath();
}

// The Keep's seal (ring, four-point star, crescent) as a height map: white is raised.
export function sealRelief() {
  if (seal) {
    return seal;
  }
  const canvas = paintCanvas(SEAL_SIZE, SEAL_SIZE, 5, (context, random) => {
    const centre = SEAL_SIZE / 2;
    context.fillStyle = "#606060";
    context.fillRect(0, 0, SEAL_SIZE, SEAL_SIZE);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 10;
    context.beginPath();
    context.arc(centre, centre, SEAL_SIZE * 0.44, 0, Math.PI * 2);
    context.stroke();
    context.lineWidth = 4;
    context.beginPath();
    context.arc(centre, centre, SEAL_SIZE * 0.36, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#ffffff";
    starPath(context, centre, centre, SEAL_SIZE * 0.33, SEAL_SIZE * 0.08);
    context.fill();
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(centre + SEAL_SIZE * 0.1, centre - SEAL_SIZE * 0.2, SEAL_SIZE * 0.07, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#606060";
    context.beginPath();
    context.arc(centre + SEAL_SIZE * 0.13, centre - SEAL_SIZE * 0.21, SEAL_SIZE * 0.06, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;
    for (let rune = 0; rune < 12; rune++) {
      const angle = (rune / 12) * Math.PI * 2;
      drawRune(context, centre + Math.cos(angle) * SEAL_SIZE * 0.4, centre + Math.sin(angle) * SEAL_SIZE * 0.4, SEAL_SIZE * 0.05, random);
    }
  });
  seal = toTexture(canvas, false);
  return seal;
}

const RUNE_STRIP_WIDTH = 64;
const RUNE_STRIP_HEIGHT = 512;
const RUNES_PER_STRIP = 9;
let runeStripTexture: THREE.CanvasTexture | null = null;

export function runeStrip() {
  if (runeStripTexture) {
    return runeStripTexture;
  }
  const canvas = paintCanvas(RUNE_STRIP_WIDTH, RUNE_STRIP_HEIGHT, 97, (context, random) => {
    context.strokeStyle = "rgba(255,255,255,0.95)";
    context.fillStyle = "rgba(255,255,255,0.95)";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.shadowColor = "rgba(255,255,255,0.9)";
    context.shadowBlur = 8;
    const spacing = RUNE_STRIP_HEIGHT / RUNES_PER_STRIP;
    for (let rune = 0; rune < RUNES_PER_STRIP; rune++) {
      drawRune(context, RUNE_STRIP_WIDTH / 2, spacing * (rune + 0.5), spacing * 0.55, random);
    }
  });
  runeStripTexture = toTexture(canvas, false);
  return runeStripTexture;
}

const FRIEZE_TILE = 128;
const FRIEZE_TILES = 8;
let friezeCanvases: { map: HTMLCanvasElement; bump: HTMLCanvasElement } | null = null;

function paintFrieze(forBump: boolean) {
  return paintCanvas(FRIEZE_TILE * FRIEZE_TILES, FRIEZE_TILE, 109, (context, random) => {
    context.fillStyle = forBump ? "#c8c8c8" : "#7d7266";
    context.fillRect(0, 0, FRIEZE_TILE * FRIEZE_TILES, FRIEZE_TILE);
    context.strokeStyle = forBump ? "#3a3a3a" : "rgba(30,24,18,0.55)";
    context.fillStyle = context.strokeStyle;
    context.lineWidth = 5;
    context.lineCap = "round";
    context.strokeRect(4, 6, FRIEZE_TILE * FRIEZE_TILES - 8, FRIEZE_TILE - 12);
    for (let tile = 0; tile < FRIEZE_TILES; tile++) {
      const centerX = tile * FRIEZE_TILE + FRIEZE_TILE / 2;
      const centerY = FRIEZE_TILE / 2;
      const reach = FRIEZE_TILE * 0.36;
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(centerX - reach, centerY);
      context.lineTo(centerX, centerY - reach);
      context.lineTo(centerX + reach, centerY);
      context.lineTo(centerX, centerY + reach);
      context.closePath();
      context.stroke();
      context.beginPath();
      context.arc(centerX, centerY, reach * 0.42, 0, Math.PI * 2);
      context.stroke();
      context.lineWidth = 3;
      drawRune(context, centerX, centerY, reach * 0.5, random);
      context.beginPath();
      context.arc(tile * FRIEZE_TILE, centerY, 6, 0, Math.PI * 2);
      context.fill();
    }
  });
}

export function friezeTextures(): SurfaceTextures {
  friezeCanvases = friezeCanvases ?? { map: paintFrieze(false), bump: paintFrieze(true) };
  return { map: toTexture(friezeCanvases.map, true), bump: toTexture(friezeCanvases.bump, false) };
}
