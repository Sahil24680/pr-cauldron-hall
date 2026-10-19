import { useMemo } from "react";
import * as THREE from "three";
import { hallReflections, potionLabels, radialGlow } from "../textures";
import { type BillboardSize, Billboards } from "./Billboards";
import { billboardQuad, createGlowMaterial } from "./glowShaders";
import { hallClock } from "./hallClock";
import { createDriftGeometry, createDriftMaterial } from "./particles";
import { type Potion, type Spill, buildPotions } from "./potionParts";

type Props = { potions: Potion[]; spills: Spill[]; seed: number };

const BUBBLES_PER_BOTTLE = 6;
const BUBBLE_SPREAD = 0.05;
const WISPS_PER_BOTTLE = 5;
const SPARKLES_PER_BOTTLE = 1;
const SPARKLE_REACH = 0.25;
const SPARKLE_RISE = 0.35;
const GLOW_SIZES: BillboardSize[] = [[0.32, 0.32]];
const LIQUID_GLOW = "1.15";
const GLASS_RIM_ALPHA = "0.75";

const glass = new THREE.MeshPhysicalMaterial({
  vertexColors: true,
  roughness: 0.06,
  metalness: 0,
  transparent: true,
  opacity: 0.16,
  ior: 1.5,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  envMap: hallReflections(),
  envMapIntensity: 2.4,
  depthWrite: false,
});
// Thick-looking edges, highlights that stay bright on clear glass, and dust that settles only on upward faces.
glass.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute float aDust;\nvarying float vDust;\nvarying vec3 vDustPoint;")
    .replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvDust = aDust * smoothstep(0.25, 0.9, normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz).y);\nvDustPoint = position;",
    );
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vDust;\nvarying vec3 vDustPoint;").replace(
    "#include <opaque_fragment>",
    `float rim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);
    float speck = fract(sin(dot(floor(vDustPoint * 400.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    float dust = vDust * (0.55 + 0.45 * speck);
    outgoingLight = mix(outgoingLight, vec3(0.3, 0.27, 0.24), dust);
    diffuseColor.a = clamp(mix(diffuseColor.a, ${GLASS_RIM_ALPHA}, rim) + max(totalSpecular.r, totalSpecular.g) + dust * 0.75, 0.0, 1.0);
    #include <opaque_fragment>`,
  );
};

const liquid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0 });
liquid.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = hallClock.uTime;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vSwirlPoint;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSwirlPoint = position;");
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec3 vSwirlPoint;").replace(
    "#include <emissivemap_fragment>",
    `#include <emissivemap_fragment>
    float swirl = sin(vSwirlPoint.y * 28.0 + sin(vSwirlPoint.x * 40.0 + uTime * 0.6) * 1.6 + sin(vSwirlPoint.z * 36.0 - uTime * 0.5) * 1.2 - uTime * 0.9);
    totalEmissiveRadiance += vColor.rgb * ${LIQUID_GLOW} * (0.84 + 0.16 * swirl);`,
  );
};

const cork = new THREE.MeshStandardMaterial({ color: "#9b7450", roughness: 0.92 });
const wax = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32 });
const twine = new THREE.MeshStandardMaterial({ color: "#c9b184", roughness: 1 });
const labels = new THREE.MeshStandardMaterial({ map: potionLabels(), roughness: 0.9, side: THREE.DoubleSide });
const pools = new THREE.MeshBasicMaterial({
  map: radialGlow(),
  vertexColors: true,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const inner = createGlowMaterial({ color: "#ffffff", intensity: 0.32, pulse: 0.12 });
const bubbles = createDriftMaterial({
  color: "#f2fff6",
  velocity: [0, 0.07, 0],
  wander: 0.01,
  life: 1.4,
  size: 0.009,
  opacity: 0.9,
  twinkle: 0,
  shape: "soft",
  additive: true,
});
const wisps = createDriftMaterial({
  color: "#b9a8ff",
  colorEnd: "#5a6470",
  velocity: [0, 0.11, 0],
  wander: 0.14,
  life: 4.5,
  size: 0.05,
  sizeEnd: 0.4,
  opacity: 0.06,
  twinkle: 0,
  shape: "soft",
  additive: true,
});
const sparkles = createDriftMaterial({
  color: "#ffe9b0",
  colorEnd: "#c7a6ff",
  velocity: [0, 0.05, 0],
  wander: 0.2,
  life: 6,
  size: 0.03,
  opacity: 0.9,
  twinkle: 0.8,
  shape: "star",
  additive: true,
});

function around(points: THREE.Vector3[], each: number, spread: number, lift: number, seed: number) {
  return createDriftGeometry(points.length * each, seed, (random, index) => {
    const origin = points[Math.floor(index / each)] ?? new THREE.Vector3();
    return [origin.x + (random() - 0.5) * spread, origin.y + random() * lift, origin.z + (random() - 0.5) * spread];
  });
}

export function PotionSet({ potions, spills, seed }: Props) {
  const parts = useMemo(() => buildPotions(potions, spills), [potions, spills]);
  const effects = useMemo(() => {
    const glowAt = parts.glows.map((glow) => glow.at);
    return {
      bubbles: around(parts.bubbles, BUBBLES_PER_BOTTLE, BUBBLE_SPREAD, 0.02, seed),
      wisps: around(parts.wisps, WISPS_PER_BOTTLE, 0.01, 0, seed + 1),
      sparkles: around(glowAt, SPARKLES_PER_BOTTLE, SPARKLE_REACH, SPARKLE_RISE, seed + 2),
      glowAt,
      glowTints: parts.glows.map((glow) => glow.color),
    };
  }, [parts, seed]);
  return (
    <group>
      <mesh geometry={parts.liquid} material={liquid} />
      <mesh geometry={parts.cork} material={cork} />
      <mesh geometry={parts.wax} material={wax} />
      <mesh geometry={parts.twine} material={twine} />
      <mesh geometry={parts.labels} material={labels} />
      <mesh geometry={parts.pools} material={pools} />
      <mesh geometry={parts.glass} material={glass} />
      <Billboards at={effects.glowAt} sizes={GLOW_SIZES} geometry={billboardQuad} material={inner} tints={effects.glowTints} />
      <points geometry={effects.bubbles} material={bubbles} frustumCulled={false} />
      <points geometry={effects.wisps} material={wisps} frustumCulled={false} />
      <points geometry={effects.sparkles} material={sparkles} frustumCulled={false} />
    </group>
  );
}
