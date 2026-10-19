import * as THREE from "three";
import { seededRandom } from "../textures";
import { hallClock } from "./hallClock";

export type DriftShape = "soft" | "star";
export type DriftOptions = {
  color: THREE.ColorRepresentation;
  colorEnd?: THREE.ColorRepresentation;
  velocity: [number, number, number];
  wander: number;
  life: number;
  size: number;
  sizeEnd?: number;
  opacity: number;
  twinkle: number;
  shape: DriftShape;
  additive: boolean;
};
export type Spawner = (random: () => number, index: number) => [number, number, number];

const driftVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uHalfHeight;
  uniform float uLife;
  uniform float uSize;
  uniform float uSizeEnd;
  uniform float uWander;
  uniform float uTwinkle;
  uniform vec3 uVelocity;
  varying float vAlpha;
  varying float vAge;
  void main() {
    float age = fract(uTime / uLife + aSeed);
    vec3 drifted = position + uVelocity * age * uLife;
    drifted.x += sin(uTime * 0.9 + aSeed * 37.0) * uWander * age;
    drifted.z += cos(uTime * 0.7 + aSeed * 53.0) * uWander * age;
    vec4 view = modelViewMatrix * vec4(drifted, 1.0);
    float fade = smoothstep(0.0, 0.15, age) * (1.0 - smoothstep(0.65, 1.0, age));
    float glint = pow(0.5 + 0.5 * sin(uTime * 2.7 + aSeed * 91.0 + dot(cameraPosition, vec3(1.7, 0.9, 1.3))), 6.0);
    vAlpha = fade * mix(1.0, glint, uTwinkle);
    vAge = age;
    gl_PointSize = mix(uSize, uSizeEnd, age) * projectionMatrix[1][1] * uHalfHeight / -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

const driftFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColorEnd;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vAge;
  void main() {
    vec2 point = gl_PointCoord * 2.0 - 1.0;
    float radius = length(point);
    #ifdef STAR
      float rays = max(0.0, 1.0 - abs(point.x) * 9.0) * (1.0 - abs(point.y)) + max(0.0, 1.0 - abs(point.y) * 9.0) * (1.0 - abs(point.x));
      float shape = max(rays, 1.0 - smoothstep(0.0, 0.3, radius));
    #else
      float shape = 1.0 - smoothstep(0.0, 1.0, radius);
      shape *= shape;
    #endif
    float alpha = shape * vAlpha * uOpacity;
    if (alpha < 0.002) {
      discard;
    }
    gl_FragColor = vec4(mix(uColor, uColorEnd, vAge), alpha);
  }
`;

export function createDriftMaterial(options: DriftOptions) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: hallClock.uTime,
      uHalfHeight: hallClock.uHalfHeight,
      uLife: { value: options.life },
      uSize: { value: options.size },
      uSizeEnd: { value: options.sizeEnd ?? options.size },
      uWander: { value: options.wander },
      uTwinkle: { value: options.twinkle },
      uVelocity: { value: new THREE.Vector3(...options.velocity) },
      uColor: { value: new THREE.Color(options.color) },
      uColorEnd: { value: new THREE.Color(options.colorEnd ?? options.color) },
      uOpacity: { value: options.opacity },
    },
    defines: options.shape === "star" ? { STAR: "" } : {},
    vertexShader: driftVertex,
    fragmentShader: driftFragment,
    transparent: true,
    depthWrite: false,
    blending: options.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

export function createDriftGeometry(count: number, seed: number, spawn: Spawner) {
  const random = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    positions.set(spawn(random, index), index * 3);
    seeds[index] = random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  return geometry;
}
