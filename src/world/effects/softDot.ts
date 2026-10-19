import * as THREE from "three";

const SIZE = 64;
let texture: THREE.CanvasTexture | null = null;

// A round glow for point sprites, which otherwise draw as hard squares.
export function softDot() {
  if (texture) {
    return texture;
  }
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d");
  if (context) {
    const glow = context.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.35, "rgba(255,255,255,0.75)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, SIZE, SIZE);
  }
  texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
