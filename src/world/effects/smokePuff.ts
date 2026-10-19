import * as THREE from "three";

const SIZE = 128;
// Lobes of one puff as [x, y, radius, brightness], in fractions of the canvas; overlapping lobes give a billowed edge.
const LOBES = [
  [0.5, 0.52, 0.34, 1],
  [0.34, 0.42, 0.22, 0.85],
  [0.66, 0.4, 0.24, 0.9],
  [0.42, 0.66, 0.2, 0.8],
  [0.64, 0.64, 0.2, 0.75],
  [0.5, 0.3, 0.18, 0.85],
] as const;
let texture: THREE.CanvasTexture | null = null;

// A soft lumpy cloud for smoke sprites; tint it with the sprite colour.
export function smokePuff() {
  if (texture) {
    return texture;
  }
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d");
  if (context) {
    for (const [x, y, radius, brightness] of LOBES) {
      const shade = Math.round(255 * brightness);
      const lobe = context.createRadialGradient(x * SIZE, y * SIZE, 0, x * SIZE, y * SIZE, radius * SIZE);
      lobe.addColorStop(0, `rgba(${shade},${shade},${shade},0.8)`);
      lobe.addColorStop(0.6, `rgba(${shade},${shade},${shade},0.45)`);
      lobe.addColorStop(1, `rgba(${shade},${shade},${shade},0)`);
      context.fillStyle = lobe;
      context.fillRect(0, 0, SIZE, SIZE);
    }
  }
  texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
