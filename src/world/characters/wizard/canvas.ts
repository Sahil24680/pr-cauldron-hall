import * as THREE from "three";

// Every procedural texture is painted once per key and shared by all wizards.
const cache = new Map<string, THREE.Texture>();

export type Repeat = [number, number];

export function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function paint(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) {
    draw(context);
  }
  return canvas;
}

// A transparent layer composited onto `context`; `finish` runs on the layer alone, e.g. to hatch stitches over its shapes.
export function layer(
  context: CanvasRenderingContext2D,
  draw: (layerContext: CanvasRenderingContext2D) => void,
  finish?: (layerContext: CanvasRenderingContext2D) => void,
) {
  const { width, height } = context.canvas;
  const canvas = paint(width, height, (layerContext) => {
    draw(layerContext);
    if (finish) {
      layerContext.globalCompositeOperation = "source-atop";
      finish(layerContext);
    }
  });
  context.drawImage(canvas, 0, 0);
}

export function cachedTexture(key: string, make: () => HTMLCanvasElement, repeat: Repeat, kind: "color" | "data") {
  const existing = cache.get(key);
  if (existing) {
    return existing;
  }
  const texture = new THREE.CanvasTexture(make());
  texture.colorSpace = kind === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 8;
  cache.set(key, texture);
  return texture;
}

export function hex(color: THREE.Color) {
  return `#${color.getHexString()}`;
}

export function shade(base: string, lightness: number, saturation = 0) {
  return hex(new THREE.Color(base).offsetHSL(0, saturation, lightness));
}

// Converts a grayscale height painting (white is raised) into a tangent-space normal map. Canvas rows run down
// while texture v runs up, so the row slope enters the green channel with its sign flipped back.
export function heightToNormal(height: HTMLCanvasElement, strength: number) {
  const { width, height: rows } = height;
  const source = height.getContext("2d")?.getImageData(0, 0, width, rows).data;
  return paint(width, rows, (context) => {
    if (!source) {
      return;
    }
    const output = context.createImageData(width, rows);
    const at = (x: number, y: number) => (source[(((y + rows) % rows) * width + ((x + width) % width)) * 4] ?? 0) / 255;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
        const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
        const length = Math.hypot(dx, dy, 1);
        const index = (y * width + x) * 4;
        output.data[index] = ((-dx / length) * 0.5 + 0.5) * 255;
        output.data[index + 1] = ((dy / length) * 0.5 + 0.5) * 255;
        output.data[index + 2] = ((1 / length) * 0.5 + 0.5) * 255;
        output.data[index + 3] = 255;
      }
    }
    context.putImageData(output, 0, 0);
  });
}

export function softBlob(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// Draws `draw` at every horizontal and vertical wrap offset so marks near an edge continue on the opposite edge.
export function tiled(context: CanvasRenderingContext2D, draw: (offsetX: number, offsetY: number) => void) {
  const { width, height } = context.canvas;
  for (const offsetX of [-width, 0, width]) {
    for (const offsetY of [-height, 0, height]) {
      draw(offsetX, offsetY);
    }
  }
}
