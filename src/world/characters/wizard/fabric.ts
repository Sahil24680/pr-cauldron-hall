import { type Repeat, cachedTexture, layer, paint, seeded, shade, softBlob, tiled } from "./canvas";
import {
  type AlchemySign,
  type Motif,
  type RobePattern,
  alchemySign,
  crescent,
  diamond,
  dot,
  flower,
  leaf,
  medallionGlyph,
  moonPhase,
  palmette,
  ring,
  rosette,
  rune,
  sparkle,
  swirl,
  triangle,
} from "./motifs";

export type { Motif, RobePattern };

const ROBE_SIZE = 512;
const ROBE_REPEAT: Repeat = [3, 2];
export const ROBE_TILES_AROUND = ROBE_REPEAT[0];
const SWATCH_SIZE = 256;
// Leather stitch rows sit this far in from the top and bottom of the texture: the welt of a boot, both edges of a strap.
const LEATHER_STITCH_ROWS = [0.12, 0.88];
const HATCH_SPACING = 3;
const THREAD_SHADOW = "rgba(0,0,0,0.38)";
// The front band covers this share of the way round the body: about 7 cm at the chest, widening down the skirt.
const ORPHREY_SHARE = 0.07;
const ORPHREY_CORD = 9;

type Ink = { base: string; ink: string };

function mottle(context: CanvasRenderingContext2D, size: number, random: () => number, count: number, strength: number) {
  for (let blob = 0; blob < count; blob++) {
    const light = random() > 0.5;
    const radius = size * (0.08 + random() * 0.18);
    const x = random() * size;
    const y = random() * size;
    tiled(context, (offsetX, offsetY) =>
      softBlob(context, x + offsetX, y + offsetY, radius, light ? `rgba(255,255,255,${strength})` : `rgba(0,0,0,${strength * 1.3})`),
    );
  }
}

function flecks(context: CanvasRenderingContext2D, size: number, random: () => number, count: number) {
  for (let fleck = 0; fleck < count; fleck++) {
    context.fillStyle = random() > 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
    context.fillRect(random() * size, random() * size, 2, 1);
  }
}

// A panel seam runs down the left edge of every repeat, top-stitched in a thread a shade lighter than the cloth.
function seam(context: CanvasRenderingContext2D, dark: string, thread: string) {
  context.fillStyle = dark;
  context.fillRect(0, 0, 2, ROBE_SIZE);
  context.fillStyle = thread;
  for (let y = 0; y < ROBE_SIZE; y += 11) {
    context.fillRect(5, y, 1.5, 6);
  }
}

function hatch(context: CanvasRenderingContext2D, color: string) {
  const { width, height } = context.canvas;
  context.strokeStyle = color;
  context.lineWidth = 1;
  for (let x = -height; x < width; x += HATCH_SPACING) {
    context.beginPath();
    context.moveTo(x, height);
    context.lineTo(x + height, 0);
    context.stroke();
  }
}

// Metal thread: a soft shadow under the stitching, then the thread itself crossed by fine satin-stitch hatching.
function embroider(context: CanvasRenderingContext2D, ink: string, draw: (thread: CanvasRenderingContext2D) => void) {
  layer(context, (shadow) => {
    shadow.translate(1.5, 2);
    shadow.fillStyle = THREAD_SHADOW;
    shadow.strokeStyle = THREAD_SHADOW;
    draw(shadow);
  });
  layer(
    context,
    (thread) => {
      thread.fillStyle = ink;
      thread.strokeStyle = ink;
      draw(thread);
    },
    (thread) => hatch(thread, shade(ink, 0.14)),
  );
}

// Damask woven into the ground: an ogee lattice of two mirrored waves per column, a palmette in every cell and a
// rosette where cells pinch together. Cells are half a tile wide and tall, dropped by half a cell per column.
function damaskGround(context: CanvasRenderingContext2D, tone: string, palmetteSize: number, lineWidth: number) {
  const half = ROBE_SIZE / 2;
  const quarter = ROBE_SIZE / 4;
  context.fillStyle = tone;
  context.strokeStyle = tone;
  context.lineWidth = lineWidth;
  for (const column of [0, half]) {
    for (const mirror of [-1, 1]) {
      tiled(context, (offsetX, offsetY) => {
        context.beginPath();
        for (let y = 0; y <= ROBE_SIZE; y += 4) {
          context.lineTo(column + offsetX + mirror * quarter * Math.sin((y / ROBE_SIZE) * Math.PI * 2), y + offsetY);
        }
        context.stroke();
      });
    }
  }
  for (const [x, y] of [
    [quarter, half],
    [quarter * 3, 0],
  ] as const) {
    tiled(context, (offsetX, offsetY) => palmette(context, x + offsetX, y + offsetY, palmetteSize));
  }
  for (const x of [quarter, quarter * 3]) {
    for (const y of [quarter, quarter * 3]) {
      rosette(context, x, y, palmetteSize * 0.16);
    }
  }
}

// Constellations in tile pixels: stars as [x, y, radius] and the lines that join them by index.
const CONSTELLATIONS: { stars: [number, number, number][]; links: [number, number][] }[] = [
  {
    stars: [
      [300, 150, 10],
      [345, 182, 6],
      [395, 160, 8],
      [442, 210, 12],
      [410, 268, 6],
      [470, 118, 7],
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [2, 5],
    ],
  },
  {
    stars: [
      [36, 372, 7],
      [92, 418, 11],
      [150, 396, 6],
      [186, 452, 8],
      [122, 486, 6],
      [62, 504, 5],
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [1, 4],
      [4, 5],
    ],
  },
  {
    stars: [
      [214, 42, 6],
      [256, 74, 9],
      [302, 52, 6],
      [262, 16, 5],
    ],
    links: [
      [0, 1],
      [1, 2],
      [1, 3],
    ],
  },
];
const MOON_PHASES = [0.12, 0.25, 0.5, 0.75, 0.88];

function celestial(random: () => number) {
  const dust = Array.from({ length: 46 }, () => [random() * ROBE_SIZE, random() * ROBE_SIZE] as const);
  return (thread: CanvasRenderingContext2D) => {
    tiled(thread, (offsetX, offsetY) => {
      crescent(thread, 128 + offsetX, 250 + offsetY, 46, 1);
      sparkle(thread, 176 + offsetX, 206 + offsetY, 9);
      for (const { stars, links } of CONSTELLATIONS) {
        thread.lineWidth = 1.6;
        for (const [from, to] of links) {
          const [x1 = 0, y1 = 0] = stars[from] ?? [];
          const [x2 = 0, y2 = 0] = stars[to] ?? [];
          thread.beginPath();
          thread.moveTo(x1 + offsetX, y1 + offsetY);
          thread.lineTo(x2 + offsetX, y2 + offsetY);
          thread.stroke();
        }
        for (const [x, y, radius] of stars) {
          sparkle(thread, x + offsetX, y + offsetY, radius);
          dot(thread, x + offsetX, y + offsetY, radius * 0.28);
        }
      }
      MOON_PHASES.forEach((phase, index) => {
        const along = index / (MOON_PHASES.length - 1);
        moonPhase(thread, 282 + along * 196 + offsetX, 462 - Math.sin(along * Math.PI) * 22 + offsetY, 12, phase);
      });
    });
    for (const [x, y] of dust) {
      dot(thread, x, y, 1.3);
    }
  };
}

// Two inscriptions per tile, each between a heavy and a fine ruled line, with word dividers every few runes and a
// rune lozenge in the cloth between them.
const INSCRIPTION_ROWS = [96, 352];
const RUNE_PITCH = 32;
const WORD_LENGTH = 5;

function runic(random: () => number) {
  const glyphs = INSCRIPTION_ROWS.map(() => Array.from({ length: ROBE_SIZE / RUNE_PITCH }, () => Math.floor(random() * 12)));
  return (thread: CanvasRenderingContext2D) => {
    INSCRIPTION_ROWS.forEach((row, band) => {
      for (const side of [-1, 1]) {
        thread.fillRect(0, row + side * 28 - 1.5, ROBE_SIZE, 3);
        thread.fillRect(0, row + side * 22 - 0.75, ROBE_SIZE, 1.5);
      }
      glyphs[band]?.forEach((glyph, slot) => {
        const x = (slot + 0.5) * RUNE_PITCH;
        if (slot % WORD_LENGTH === WORD_LENGTH - 1) {
          dot(thread, x, row - 6, 2.4);
          dot(thread, x, row + 6, 2.4);
        } else {
          rune(thread, x, row, 13, glyph);
        }
      });
    });
    for (const [x, y, glyph] of [
      [128, 224, 3],
      [384, 480, 7],
    ] as const) {
      thread.lineWidth = 2.5;
      diamond(thread, x, y, 24, 30);
      thread.stroke();
      rune(thread, x, y, 11, glyph);
      dot(thread, x - 40, y, 3);
      dot(thread, x + 40, y, 3);
    }
  };
}

// A seal: double ring with a ring of stitches between, and either a triangle round the sun or the squared circle
// (square, triangle and circle nested inside).
function seal(thread: CanvasRenderingContext2D, x: number, y: number, radius: number, squared: boolean) {
  thread.lineWidth = 3;
  ring(thread, x, y, radius);
  thread.lineWidth = 1.5;
  ring(thread, x, y, radius - 9);
  for (let stitch = 0; stitch < 28; stitch++) {
    const angle = (stitch / 28) * Math.PI * 2;
    dot(thread, x + Math.cos(angle) * (radius - 4.5), y + Math.sin(angle) * (radius - 4.5), 1.6);
  }
  const inner = radius - 9;
  thread.lineWidth = 2.5;
  if (squared) {
    const halfSide = inner / Math.SQRT2;
    thread.strokeRect(x - halfSide, y - halfSide, halfSide * 2, halfSide * 2);
    triangle(thread, x, y + halfSide * 0.2, halfSide * 0.95, 1);
    ring(thread, x, y + halfSide * 0.2, halfSide * 0.42);
    dot(thread, x, y + halfSide * 0.2, 3);
  } else {
    triangle(thread, x, y + inner * 0.08, inner * 0.95, 1);
    ring(thread, x, y + inner * 0.12, inner * 0.3);
    dot(thread, x, y + inner * 0.12, inner * 0.08);
  }
}

const ALCHEMY_SCATTER: [number, number, AlchemySign, number][] = [
  [384, 128, "fire", 30],
  [128, 384, "water", 30],
  [256, 256, "sulfur", 18],
  [0, 0, "salt", 18],
  [256, 0, "mercury", 18],
  [0, 256, "earth", 18],
];

function alchemy() {
  return (thread: CanvasRenderingContext2D) => {
    tiled(thread, (offsetX, offsetY) => {
      seal(thread, 128 + offsetX, 128 + offsetY, 68, false);
      seal(thread, 384 + offsetX, 384 + offsetY, 68, true);
      for (const [x, y, sign, size] of ALCHEMY_SCATTER) {
        alchemySign(thread, sign, x + offsetX, y + offsetY, size);
      }
    });
  };
}

// Herb vines climbing the cloth in two columns, leafing on alternate sides, each with two flowers per repeat.
const VINE_SWAY = 55;
const LEAF_PITCH = 40;

function herbal() {
  const vineX = (column: number, y: number) => column + VINE_SWAY * Math.sin((y / ROBE_SIZE) * Math.PI * 2 + (column > ROBE_SIZE / 2 ? Math.PI : 0));
  return (thread: CanvasRenderingContext2D) => {
    for (const column of [ROBE_SIZE / 4, (ROBE_SIZE * 3) / 4]) {
      tiled(thread, (offsetX, offsetY) => {
        thread.lineWidth = 3;
        thread.lineCap = "round";
        thread.beginPath();
        for (let y = 0; y <= ROBE_SIZE; y += 4) {
          thread.lineTo(vineX(column, y) + offsetX, y + offsetY);
        }
        thread.stroke();
        for (let y = LEAF_PITCH / 2; y < ROBE_SIZE; y += LEAF_PITCH) {
          const side = Math.round(y / LEAF_PITCH) % 2 === 0 ? 1 : -1;
          leaf(thread, vineX(column, y) + side * 15 + offsetX, y + offsetY, 14, side * 0.9);
        }
        for (const y of [ROBE_SIZE / 4, (ROBE_SIZE * 3) / 4]) {
          const outward = Math.sign(vineX(column, y) - column) || 1;
          thread.lineWidth = 2;
          swirl(thread, vineX(column, y) + outward * 10 + offsetX, y - 26 + offsetY, 9, outward);
          flower(thread, vineX(column, y) + outward * 24 + offsetX, y + offsetY, 17);
        }
      });
    }
  };
}

type RobePainter = (context: CanvasRenderingContext2D, colors: Ink, random: () => number) => void;

function embroidered(design: (random: () => number) => (thread: CanvasRenderingContext2D) => void): RobePainter {
  return (context, { base, ink }, random) => {
    damaskGround(context, shade(base, 0.035), 90, 3);
    embroider(context, ink, design(random));
  };
}

// Each pattern over the shared cloth (base colour, shadow mottling, wool flecks and a seam). Damask is tone-on-tone
// only, in two shades of the cloth; plain is the weave alone.
const ROBE_PAINTERS: Record<RobePattern, RobePainter> = {
  celestial: embroidered(celestial),
  runic: embroidered(runic),
  alchemy: embroidered(alchemy),
  herbal: embroidered(herbal),
  damask: (context, { base }) => {
    damaskGround(context, shade(base, -0.12, 0.05), 186, 9);
    damaskGround(context, shade(base, 0.09, -0.05), 156, 3);
  },
  plain: () => {},
};

const tileCanvases = new Map<string, HTMLCanvasElement>();

function robeTile(base: string, pattern: RobePattern, ink: string) {
  const key = `${base}|${pattern}|${ink}`;
  const existing = tileCanvases.get(key);
  if (existing) {
    return existing;
  }
  const canvas = paint(ROBE_SIZE, ROBE_SIZE, (context) => {
    const random = seeded(pattern.length * 97 + base.length);
    context.fillStyle = base;
    context.fillRect(0, 0, ROBE_SIZE, ROBE_SIZE);
    mottle(context, ROBE_SIZE, random, 26, 0.05);
    flecks(context, ROBE_SIZE, random, 6000);
    seam(context, shade(base, -0.12), shade(base, 0.14));
    ROBE_PAINTERS[pattern](context, { base, ink }, random);
  });
  tileCanvases.set(key, canvas);
  return canvas;
}

// Painted robe cloth in the wearer's pattern, tiling seamlessly at any repeat.
export function robeFabric(base: string, pattern: RobePattern, ink: string, repeat: Repeat = ROBE_REPEAT) {
  return cachedTexture(`robe|${base}|${pattern}|${ink}|${repeat.join("x")}`, () => robeTile(base, pattern, ink), repeat, "color");
}

// The orphrey: an embroidered band in the trim colour down the front centre, cord-edged, with a vine of filigree
// threading the pattern's medallions.
function orphrey(context: CanvasRenderingContext2D, centre: number, width: number, pattern: RobePattern, band: string, ink: string) {
  const left = centre - width / 2;
  const gradient = context.createLinearGradient(left, 0, left + width, 0);
  gradient.addColorStop(0, shade(band, -0.1));
  gradient.addColorStop(0.5, shade(band, 0.03));
  gradient.addColorStop(1, shade(band, -0.1));
  context.fillStyle = gradient;
  context.fillRect(left, 0, width, ROBE_SIZE);
  const sway = width * 0.17;
  const stemAt = (y: number) => centre + Math.sin((y / ROBE_SIZE) * Math.PI * 4) * sway;
  const medallionRadius = width * 0.3;
  embroider(context, ink, (thread) => {
    thread.lineWidth = 2.5;
    thread.lineCap = "round";
    thread.beginPath();
    for (let y = 0; y <= ROBE_SIZE; y += 4) {
      thread.lineTo(stemAt(y), y);
    }
    thread.stroke();
    for (let crest = 0; crest < 4; crest++) {
      const y = ((crest + 0.5) / 4) * ROBE_SIZE;
      const side = crest % 2 === 0 ? 1 : -1;
      if (pattern === "herbal") {
        leaf(thread, stemAt(y) + side * width * 0.12, y, width * 0.1, side * 0.6);
      } else {
        swirl(thread, stemAt(y) + side * width * 0.12, y - width * 0.06, width * 0.11, side);
      }
    }
    for (const y of [0, ROBE_SIZE / 2, ROBE_SIZE]) {
      diamond(thread, centre, y, width * 0.06, width * 0.09);
      thread.fill();
    }
    [ROBE_SIZE / 4, (ROBE_SIZE * 3) / 4].forEach((y, index) => {
      thread.globalCompositeOperation = "destination-out";
      dot(thread, centre, y, medallionRadius);
      thread.globalCompositeOperation = "source-over";
      thread.lineWidth = 2;
      ring(thread, centre, y, medallionRadius * 0.92);
      medallionGlyph(thread, pattern, centre, y, medallionRadius * 0.62, index);
    });
    for (const edge of [left, left + width - ORPHREY_CORD]) {
      thread.fillRect(edge, 0, ORPHREY_CORD, ROBE_SIZE);
    }
  });
  context.strokeStyle = shade(ink, -0.28);
  context.lineWidth = 1.5;
  for (const edge of [left, left + width - ORPHREY_CORD]) {
    for (let y = -ORPHREY_CORD; y < ROBE_SIZE + ORPHREY_CORD; y += 6) {
      context.beginPath();
      context.moveTo(edge, y + ORPHREY_CORD);
      context.lineTo(edge + ORPHREY_CORD, y);
      context.stroke();
    }
  }
}

// The robe body's map: the pattern tile repeated once round the body with the orphrey at the front centre (u = 0.5),
// so it is painted whole rather than tiled. Plain robes stay plain.
export function robeBodyFabric(base: string, pattern: RobePattern, ink: string, band: string) {
  const [, down] = ROBE_REPEAT;
  if (pattern === "plain") {
    return robeFabric(base, pattern, ink);
  }
  return cachedTexture(
    `robe-body|${base}|${pattern}|${ink}|${band}`,
    () =>
      paint(ROBE_SIZE * ROBE_TILES_AROUND, ROBE_SIZE, (context) => {
        const tile = robeTile(base, pattern, ink);
        for (let copy = 0; copy < ROBE_TILES_AROUND; copy++) {
          context.drawImage(tile, copy * ROBE_SIZE, 0);
        }
        orphrey(context, (ROBE_SIZE * ROBE_TILES_AROUND) / 2, ROBE_SIZE * ROBE_TILES_AROUND * ORPHREY_SHARE, pattern, band, ink);
      }),
    [1, down],
    "color",
  );
}

// Undershirt linen: a pale shade of the robe with slubbed threads and fine pinstripes, so it reads as another garment.
export function linenFabric(base: string, repeat: Repeat) {
  return cachedTexture(
    `linen|${base}|${repeat.join("x")}`,
    () =>
      paint(SWATCH_SIZE, SWATCH_SIZE, (context) => {
        const random = seeded(base.length * 31);
        context.fillStyle = base;
        context.fillRect(0, 0, SWATCH_SIZE, SWATCH_SIZE);
        for (let slub = 0; slub < 220; slub++) {
          context.fillStyle = random() > 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
          context.fillRect(random() * SWATCH_SIZE, random() * SWATCH_SIZE, 10 + random() * 40, 1.5);
        }
        context.fillStyle = shade(base, -0.16);
        for (let x = 0; x < SWATCH_SIZE; x += SWATCH_SIZE / 8) {
          context.fillRect(x, 0, 1.5, SWATCH_SIZE);
        }
      }),
    repeat,
    "color",
  );
}

// Lining satin, quilted in diamonds with a stitch at every crossing.
export function satinFabric(base: string, repeat: Repeat) {
  return cachedTexture(
    `satin|${base}|${repeat.join("x")}`,
    () =>
      paint(SWATCH_SIZE, SWATCH_SIZE, (context) => {
        const gradient = context.createLinearGradient(0, 0, SWATCH_SIZE, SWATCH_SIZE);
        gradient.addColorStop(0, shade(base, 0.04));
        gradient.addColorStop(0.5, shade(base, -0.04));
        gradient.addColorStop(1, shade(base, 0.04));
        context.fillStyle = gradient;
        context.fillRect(0, 0, SWATCH_SIZE, SWATCH_SIZE);
        context.strokeStyle = shade(base, -0.14);
        context.lineWidth = 2;
        const step = SWATCH_SIZE / 4;
        for (let offset = -SWATCH_SIZE; offset <= SWATCH_SIZE; offset += step) {
          context.beginPath();
          context.moveTo(offset, 0);
          context.lineTo(offset + SWATCH_SIZE, SWATCH_SIZE);
          context.moveTo(offset, SWATCH_SIZE);
          context.lineTo(offset + SWATCH_SIZE, 0);
          context.stroke();
        }
      }),
    repeat,
    "color",
  );
}

function leatherStitches(context: CanvasRenderingContext2D, color: string, width: number, height: number) {
  context.fillStyle = color;
  for (const row of LEATHER_STITCH_ROWS) {
    for (let x = 0; x < SWATCH_SIZE; x += 10) {
      context.fillRect(x, row * SWATCH_SIZE - height / 2, width, height);
    }
  }
}

// Leather: mottled hide, burnished darker toward both edges, with a row of saddle stitches along each.
export function leatherFabric(base: string, repeat: Repeat) {
  return cachedTexture(
    `leather|${base}|${repeat.join("x")}`,
    () =>
      paint(SWATCH_SIZE, SWATCH_SIZE, (context) => {
        const random = seeded(base.length * 53);
        const gradient = context.createLinearGradient(0, 0, 0, SWATCH_SIZE);
        gradient.addColorStop(0, shade(base, -0.06));
        gradient.addColorStop(0.2, base);
        gradient.addColorStop(0.8, base);
        gradient.addColorStop(1, shade(base, -0.06));
        context.fillStyle = gradient;
        context.fillRect(0, 0, SWATCH_SIZE, SWATCH_SIZE);
        mottle(context, SWATCH_SIZE, random, 30, 0.07);
        leatherStitches(context, shade(base, 0.32, -0.2), 6, 2);
      }),
    repeat,
    "color",
  );
}

// Striped stockings: alternating bands, each edged with a thin darker line.
export function stripeFabric(first: string, second: string) {
  return cachedTexture(
    `stripe|${first}|${second}`,
    () =>
      paint(64, SWATCH_SIZE, (context) => {
        const band = SWATCH_SIZE / 8;
        for (let stripe = 0; stripe < 8; stripe++) {
          context.fillStyle = stripe % 2 === 0 ? first : second;
          context.fillRect(0, stripe * band, 64, band);
          context.fillStyle = "rgba(0,0,0,0.25)";
          context.fillRect(0, stripe * band, 64, 2);
        }
      }),
    [3, 1],
    "color",
  );
}
