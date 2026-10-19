import { type Repeat, cachedTexture, heightToNormal, layer, paint, shade } from "./canvas";
import { type RobePattern, diamond, dot, leaf, medallionGlyph, ring, swirl } from "./motifs";

// One tile of embroidered band holds two motif units; the belt wraps six tiles, so bands elsewhere scale u to match.
const TRIM_TILE = { width: 512, height: 160 };
const TRIM_REPEAT: Repeat = [6, 1];
const CORD = 16;
const STITCH_INSET = CORD + 9;
const UNIT_SIZE = TRIM_TILE.height * 0.2;
const TWIST_SPACING = 7;
const HATCH_SPACING = 3;
const RELIEF_STRENGTH = 2.2;

// What each part of the band is painted with: colours for the colour map, heights for the relief, metal for the sheen.
type TrimPaint = {
  background: (context: CanvasRenderingContext2D) => void;
  cord: string;
  twist: string;
  thread: string;
  hatch: string | null;
  stitch: string;
};

function cords(context: CanvasRenderingContext2D, { cord, twist, stitch }: TrimPaint) {
  const { width, height } = TRIM_TILE;
  for (const top of [0, height - CORD]) {
    context.fillStyle = cord;
    context.fillRect(0, top, width, CORD);
    context.strokeStyle = twist;
    context.lineWidth = 2;
    for (let x = -CORD; x < width + CORD; x += TWIST_SPACING) {
      context.beginPath();
      context.moveTo(x, top + CORD);
      context.lineTo(x + CORD * 0.8, top);
      context.stroke();
    }
  }
  context.fillStyle = stitch;
  for (let x = 0; x < width; x += 12) {
    context.fillRect(x, STITCH_INSET, 7, 2);
    context.fillRect(x + 6, height - STITCH_INSET - 2, 7, 2);
  }
}

// A wavy stem runs the band, crossing its middle at every medallion, with a curl (or a leaf, for herbal) at each crest.
function filigree(context: CanvasRenderingContext2D, pattern: RobePattern) {
  const { width, height } = TRIM_TILE;
  const middle = height / 2;
  const amplitude = UNIT_SIZE * 0.75;
  const stemAt = (x: number) => middle + Math.sin((x / width) * Math.PI * 4) * amplitude;
  context.lineWidth = 2.5;
  context.lineCap = "round";
  context.beginPath();
  for (let x = 0; x <= width; x += 4) {
    context.lineTo(x, stemAt(x));
  }
  context.stroke();
  for (let crest = 0; crest < 4; crest++) {
    const x = ((crest + 0.5) / 4) * width;
    const side = crest % 2 === 0 ? -1 : 1;
    if (pattern === "herbal") {
      leaf(context, x, stemAt(x) + side * UNIT_SIZE * 0.45, UNIT_SIZE * 0.42, side * 0.5);
    } else {
      swirl(context, x + UNIT_SIZE * 0.25, stemAt(x) + side * UNIT_SIZE * 0.35, UNIT_SIZE * 0.42, side);
    }
  }
  for (const x of [0, width / 2, width]) {
    diamond(context, x, middle, UNIT_SIZE * 0.2, UNIT_SIZE * 0.3);
    context.fill();
  }
}

function medallion(context: CanvasRenderingContext2D, pattern: RobePattern, x: number, y: number, index: number) {
  context.globalCompositeOperation = "destination-out";
  dot(context, x, y, UNIT_SIZE * 1.2);
  context.globalCompositeOperation = "source-over";
  if (pattern === "celestial") {
    for (let point = 0; point < 8; point++) {
      const angle = (point / 8) * Math.PI * 2;
      dot(context, x + Math.cos(angle) * UNIT_SIZE * 1.05, y + Math.sin(angle) * UNIT_SIZE * 1.05, 2.5);
    }
  }
  if (pattern === "plain") {
    context.lineWidth = 2.5;
    ring(context, x, y, UNIT_SIZE * 0.9);
  }
  medallionGlyph(context, pattern, x, y, UNIT_SIZE * 0.8, index);
}

function drawBand(context: CanvasRenderingContext2D, pattern: RobePattern, colors: TrimPaint) {
  colors.background(context);
  layer(
    context,
    (embroidery) => {
      embroidery.fillStyle = colors.thread;
      embroidery.strokeStyle = colors.thread;
      filigree(embroidery, pattern);
      medallion(embroidery, pattern, TRIM_TILE.width * 0.25, TRIM_TILE.height / 2, 0);
      medallion(embroidery, pattern, TRIM_TILE.width * 0.75, TRIM_TILE.height / 2, 1);
    },
    colors.hatch === null
      ? undefined
      : (embroidery) => {
          // Satin stitch: fine diagonal threads across every embroidered shape.
          embroidery.strokeStyle = colors.hatch ?? "";
          embroidery.lineWidth = 1;
          for (let x = -TRIM_TILE.height; x < TRIM_TILE.width; x += HATCH_SPACING) {
            embroidery.beginPath();
            embroidery.moveTo(x, TRIM_TILE.height);
            embroidery.lineTo(x + TRIM_TILE.height, 0);
            embroidery.stroke();
          }
        },
  );
  cords(context, colors);
}

function fill(color: string) {
  return (context: CanvasRenderingContext2D) => {
    context.fillStyle = color;
    context.fillRect(0, 0, TRIM_TILE.width, TRIM_TILE.height);
  };
}

// Contrasting band for cuffs, hems, the collar and the hat: two shades of the band colour (darker toward the cords),
// gold or silver cord edges, a running stitch, and filigree linking medallions of the wearer's pattern.
export function trimFabric(band: string, ink: string, pattern: RobePattern) {
  return cachedTexture(
    `trim|${band}|${ink}|${pattern}`,
    () =>
      paint(TRIM_TILE.width, TRIM_TILE.height, (context) =>
        drawBand(context, pattern, {
          background: (backgroundContext) => {
            const gradient = backgroundContext.createLinearGradient(0, 0, 0, TRIM_TILE.height);
            gradient.addColorStop(0, shade(band, -0.08));
            gradient.addColorStop(0.5, shade(band, 0.03));
            gradient.addColorStop(1, shade(band, -0.08));
            backgroundContext.fillStyle = gradient;
            backgroundContext.fillRect(0, 0, TRIM_TILE.width, TRIM_TILE.height);
          },
          cord: ink,
          twist: shade(ink, -0.25),
          thread: ink,
          hatch: shade(ink, 0.12),
          stitch: shade(ink, -0.05),
        }),
      ),
    TRIM_REPEAT,
    "color",
  );
}

const RELIEF_PAINT: TrimPaint = { background: fill("#404040"), cord: "#ffffff", twist: "#a0a0a0", thread: "#b8b8b8", hatch: "#e0e0e0", stitch: "#707070" };

export function trimRelief(pattern: RobePattern) {
  return cachedTexture(
    `trim-relief|${pattern}`,
    () =>
      heightToNormal(
        paint(TRIM_TILE.width, TRIM_TILE.height, (context) => drawBand(context, pattern, RELIEF_PAINT)),
        RELIEF_STRENGTH,
      ),
    TRIM_REPEAT,
    "data",
  );
}

// Packed for three.js: green is roughness and blue is metalness, so thread and cords shine while the cloth stays matte.
const SHEEN_PAINT: TrimPaint = { background: fill("#00d900"), cord: "#0059ff", twist: "#0073ff", thread: "#0066ff", hatch: null, stitch: "#0080ff" };

export function trimSheen(pattern: RobePattern) {
  return cachedTexture(
    `trim-sheen|${pattern}`,
    () => paint(TRIM_TILE.width, TRIM_TILE.height, (context) => drawBand(context, pattern, SHEEN_PAINT)),
    TRIM_REPEAT,
    "data",
  );
}

// u for an embroidered band of the given height, so its motifs stay square however long the band runs.
export function trimTilesAlong(length: number, bandHeight: number) {
  return length / (bandHeight * (TRIM_TILE.width / TRIM_TILE.height) * TRIM_REPEAT[0]);
}

// u once around a closed band (a cuff, a hem), rounded to whole tiles so the embroidery meets itself at the seam.
export function trimTilesAround(circumference: number, bandHeight: number) {
  return Math.max(1, Math.round(trimTilesAlong(circumference, bandHeight) * TRIM_REPEAT[0])) / TRIM_REPEAT[0];
}
