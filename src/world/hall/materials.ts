import * as THREE from "three";
import { crystalReflections, friezeTextures, hallReflections, sealRelief, stoneTextures, woodTextures } from "../textures";
import { createFlameMaterial, createGlowMaterial } from "./glowShaders";

const reflections = hallReflections();

export const gold = new THREE.MeshStandardMaterial({ color: "#d9a743", metalness: 1, roughness: 0.3, envMap: reflections, envMapIntensity: 1.4 });
export const silver = new THREE.MeshStandardMaterial({ color: "#d5dbe4", metalness: 1, roughness: 0.2, envMap: reflections, envMapIntensity: 1.5 });
export const wroughtIron = new THREE.MeshStandardMaterial({ color: "#34343a", metalness: 0.85, roughness: 0.45, envMap: reflections, envMapIntensity: 0.8 });
const grain = woodTextures(1, 1);
export const carvedOak = new THREE.MeshStandardMaterial({
  color: "#a07450",
  map: grain.map,
  bumpMap: grain.bump,
  bumpScale: 1.2,
  roughness: 0.62,
  envMap: reflections,
  envMapIntensity: 0.35,
});
export const darkOak = new THREE.MeshStandardMaterial({
  color: "#5a3c26",
  map: grain.map,
  bumpMap: grain.bump,
  bumpScale: 1.2,
  roughness: 0.7,
  envMap: reflections,
  envMapIntensity: 0.25,
});
export const shadowWood = new THREE.MeshStandardMaterial({ color: "#21150d", map: grain.map, roughness: 0.95 });
export const trimStone = new THREE.MeshStandardMaterial({ color: "#857a6f", roughness: 0.88 });
export const FRIEZE_HEIGHT = 0.5;
const FRIEZE_TILES_PER_TEXTURE = 8;
const frieze = friezeTextures();
frieze.map.repeat.set(1 / (FRIEZE_HEIGHT * FRIEZE_TILES_PER_TEXTURE), 1 / FRIEZE_HEIGHT);
frieze.bump.repeat.copy(frieze.map.repeat);
export const friezeStone = new THREE.MeshStandardMaterial({ map: frieze.map, bumpMap: frieze.bump, bumpScale: 3, roughness: 0.9 });
export const BORDER_WIDTH = 0.34;
const inlay = friezeTextures();
inlay.map.repeat.set(1 / (BORDER_WIDTH * FRIEZE_TILES_PER_TEXTURE), 1 / BORDER_WIDTH);
inlay.bump.repeat.copy(inlay.map.repeat);
export const inlayStone = new THREE.MeshStandardMaterial({
  color: "#6f655d",
  map: inlay.map,
  bumpMap: inlay.bump,
  bumpScale: 2,
  roughness: 0.6,
  envMap: reflections,
  envMapIntensity: 0.3,
});
export const candleWax = new THREE.MeshStandardMaterial({ color: "#f1e6cf", roughness: 0.55, emissive: "#ffb46a", emissiveIntensity: 0.12 });

// Alpha blending instead of transmission: transmission renders the whole hall a second time every frame.
export const crystal = new THREE.MeshPhysicalMaterial({
  color: "#44444e",
  vertexColors: true,
  metalness: 0,
  roughness: 0.02,
  transparent: true,
  opacity: 0.55,
  ior: 2.1,
  clearcoat: 1,
  clearcoatRoughness: 0.02,
  iridescence: 0.9,
  iridescenceIOR: 1.7,
  iridescenceThicknessRange: [180, 620],
  envMap: crystalReflections(),
  envMapIntensity: 7,
  flatShading: true,
});
const CRYSTAL_INNER_GLOW = "0.38";
// Lets each bead's tint glow faintly from inside instead of only colouring the diffuse light it catches.
crystal.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <emissivemap_fragment>",
    `#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * ${CRYSTAL_INNER_GLOW};`,
  );
};

export const candleFlame = createFlameMaterial({ core: "#fff4d6", mid: "#ffb347", edge: "#ff6a1f", intensity: 2.4 });
export const candleHalo = createGlowMaterial({ color: "#ffad55", intensity: 0.45, pulse: 0.05 });

const SEAL_BUMP = 4;
export const sealBrass = gold.clone();
sealBrass.bumpMap = sealRelief();
sealBrass.bumpScale = SEAL_BUMP;
const CARVED_SEAL_BUMP = 6;
export const carvedSeal = trimStone.clone();
carvedSeal.bumpMap = sealRelief();
carvedSeal.bumpScale = CARVED_SEAL_BUMP;
const MASONRY_METRES = 3;
const masonryTextures = stoneTextures("wall", 1 / MASONRY_METRES, 1 / MASONRY_METRES);
export const masonry = new THREE.MeshStandardMaterial({ map: masonryTextures.map, bumpMap: masonryTextures.bump, bumpScale: 2.5, roughness: 0.95 });
export const clearGlass = new THREE.MeshPhysicalMaterial({
  color: "#ffffff",
  roughness: 0.05,
  transparent: true,
  opacity: 0.22,
  clearcoat: 1,
  depthWrite: false,
});
