import * as THREE from "three";
import type { Repeat } from "./canvas";

// CC0 detail maps from ambientCG in public/textures (see CREDITS.txt): relief and roughness only, laid under the
// painted colour and motif maps so the cloth and leather read as real material up close.
export type Surface = "cloth-fine" | "cloth-weave" | "leather";
type Channel = "normal" | "roughness";

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

export function surfaceMap(surface: Surface, channel: Channel, repeat: Repeat) {
  const key = `${surface}|${channel}|${repeat.join("x")}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const texture = loader.load(`/textures/${surface}-${channel}.jpg`);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.colorSpace = THREE.NoColorSpace;
  cache.set(key, texture);
  return texture;
}
