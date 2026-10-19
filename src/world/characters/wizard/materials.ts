import * as THREE from "three";
import { crystalReflections, hallReflections } from "../../textures";
import type { Repeat } from "./canvas";
import { leatherFabric } from "./fabric";
import { surfaceMap } from "./photoTextures";

// Velvet: a soft rim of light at grazing angles, lighter than the cloth itself. Roughness values scale the photo
// roughness maps, which already average about 0.7.
const VELVET = { roughness: 1, sheen: 0.65, sheenRoughness: 0.45, sheenLift: 0.22 };
const SATIN = { roughness: 0.55, sheen: 0.4, sheenRoughness: 0.3 };
const LEATHER = { roughness: 1, normalScale: 0.8 };
// Garment UVs span about 0.9 m per unit, so these repeats give a weave tile of roughly 10 to 15 cm.
const FINE_REPEAT: Repeat = [7, 7];
const WEAVE_REPEAT: Repeat = [6, 6];
const WEAVE_STRENGTH = 0.55;
const GOLD_GLOW = 0.12;

type Cloth = {
  map: THREE.Texture;
  tint: THREE.ColorRepresentation;
  transparent: boolean;
  side?: THREE.Side;
  // Garments built by clothShapes bake fold and hem shading into vertex colours.
  shaded?: boolean;
};

export function velvet({ map, tint, transparent, side = THREE.FrontSide, shaded = false }: Cloth) {
  return new THREE.MeshPhysicalMaterial({
    map,
    normalMap: surfaceMap("cloth-fine", "normal", FINE_REPEAT),
    normalScale: new THREE.Vector2(WEAVE_STRENGTH, WEAVE_STRENGTH),
    roughnessMap: surfaceMap("cloth-fine", "roughness", FINE_REPEAT),
    color: "#ffffff",
    roughness: VELVET.roughness,
    sheen: VELVET.sheen,
    sheenRoughness: VELVET.sheenRoughness,
    sheenColor: new THREE.Color(tint).offsetHSL(0, -0.1, VELVET.sheenLift),
    vertexColors: shaded,
    transparent,
    side,
  });
}

export function satin({ map, tint, transparent, side = THREE.FrontSide, shaded = false }: Cloth) {
  return new THREE.MeshPhysicalMaterial({
    map,
    normalMap: surfaceMap("cloth-fine", "normal", FINE_REPEAT),
    normalScale: new THREE.Vector2(WEAVE_STRENGTH * 0.4, WEAVE_STRENGTH * 0.4),
    color: "#ffffff",
    roughness: SATIN.roughness,
    sheen: SATIN.sheen,
    sheenRoughness: SATIN.sheenRoughness,
    sheenColor: new THREE.Color(tint).offsetHSL(0, 0, 0.3),
    vertexColors: shaded,
    transparent,
    side,
  });
}

export function linen({ map, transparent, shaded = false }: Cloth) {
  return new THREE.MeshStandardMaterial({
    map,
    normalMap: surfaceMap("cloth-weave", "normal", WEAVE_REPEAT),
    normalScale: new THREE.Vector2(WEAVE_STRENGTH * 1.3, WEAVE_STRENGTH * 1.3),
    roughnessMap: surfaceMap("cloth-weave", "roughness", WEAVE_REPEAT),
    roughness: 1,
    vertexColors: shaded,
    transparent,
  });
}

export function leather(base: string, repeat: Repeat, transparent: boolean) {
  return new THREE.MeshStandardMaterial({
    map: leatherFabric(base, repeat),
    normalMap: surfaceMap("leather", "normal", repeat),
    normalScale: new THREE.Vector2(LEATHER.normalScale, LEATHER.normalScale),
    roughnessMap: surfaceMap("leather", "roughness", repeat),
    roughness: LEATHER.roughness,
    transparent,
  });
}

// Polished metal reflecting the candlelit hall, with a faint glow of its own so it stays golden in shadow.
export function metal(color: THREE.ColorRepresentation, roughness: number, transparent: boolean) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.9,
    envMap: hallReflections(),
    envMapIntensity: 1.4,
    emissive: new THREE.Color(color).multiplyScalar(GOLD_GLOW),
    transparent,
  });
}

export function jewel(color: THREE.ColorRepresentation, transparent: boolean) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.12,
    metalness: 0.3,
    envMap: crystalReflections(),
    emissive: new THREE.Color(color).multiplyScalar(0.25),
    transparent,
  });
}

// The cape is one sheet drawn from both sides; the side facing the body shows the satin lining colour.
export function capeVelvet(cloth: Cloth, lining: THREE.ColorRepresentation) {
  const material = velvet({ ...cloth, side: THREE.DoubleSide });
  const liningColor = new THREE.Color(lining);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.liningColor = { value: liningColor };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 liningColor;")
      .replace("#include <map_fragment>", "#include <map_fragment>\nif (gl_FrontFacing) { diffuseColor.rgb = liningColor; }");
  };
  material.customProgramCacheKey = () => "cape-lining";
  return material;
}
