import * as THREE from "three";
import { hallClock } from "./hallClock";

export type FlameColors = {
  core: THREE.ColorRepresentation;
  mid: THREE.ColorRepresentation;
  edge: THREE.ColorRepresentation;
  intensity: number;
  midTint?: number;
};
export type GlowOptions = { color: THREE.ColorRepresentation; intensity: number; pulse: number };

const instanceCenter = /* glsl */ `
  vec4 center = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float width = length((modelMatrix * instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  float height = length((modelMatrix * instanceMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float phase = fract(sin(dot(center.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 6.2831;
  vec3 tint = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    tint = instanceColor;
  #endif
`;

const flameVertex = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vPhase;
  varying vec3 vTint;
  void main() {
    ${instanceCenter}
    float flicker = 1.0 + 0.12 * sin(uTime * 11.0 + phase) + 0.08 * sin(uTime * 23.0 + phase * 2.0);
    vec3 toCamera = cameraPosition - center.xyz;
    vec3 across = vec3(toCamera.z, 0.0, -toCamera.x);
    vec3 right = length(across) > 0.0001 ? normalize(across) : vec3(1.0, 0.0, 0.0);
    vec3 world = center.xyz + right * position.x * width + vec3(0.0, position.y * height * flicker, 0.0);
    vUv = uv;
    vPhase = phase;
    vTint = tint;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

// instanceColor tints the edge (and the middle by midTint), so one material can burn several magical hues.
const flameFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCore;
  uniform vec3 uMid;
  uniform vec3 uEdge;
  uniform float uIntensity;
  uniform float uMidTint;
  varying vec2 vUv;
  varying float vPhase;
  varying vec3 vTint;
  void main() {
    float y = vUv.y;
    float sway = sin(y * 6.0 - uTime * 8.0 + vPhase) * 0.09 * y;
    float x = (vUv.x - 0.5) * 2.0 + sway;
    float halfWidth = 0.95 * sqrt(clamp(y * 3.5, 0.0, 1.0)) * pow(1.0 - y, 1.25);
    float body = (1.0 - smoothstep(halfWidth * 0.45, halfWidth, abs(x))) * smoothstep(0.0, 0.08, y);
    if (body <= 0.001) {
      discard;
    }
    float core = (1.0 - smoothstep(halfWidth * 0.12, halfWidth * 0.5, abs(x))) * (1.0 - smoothstep(0.08, 0.42, y));
    vec3 mid = mix(uMid, uMid * vTint, uMidTint);
    vec3 color = mix(uEdge * vTint, mid, smoothstep(0.1, 0.8, body) * (1.0 - y * 0.7));
    color = mix(color, uCore, core);
    gl_FragColor = vec4(color * uIntensity, body);
  }
`;

const glowVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;
  varying vec2 vUv;
  varying vec3 vTint;
  void main() {
    ${instanceCenter}
    float pulse = 1.0 + uPulse * sin(uTime * 2.3 + phase) + uPulse * 0.5 * sin(uTime * 7.1 + phase * 3.0);
    vec4 view = viewMatrix * center;
    view.xy += position.xy * vec2(width, height) * pulse;
    vUv = uv;
    vTint = tint;
    gl_Position = projectionMatrix * view;
  }
`;

const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  varying vec3 vTint;
  void main() {
    float falloff = max(0.0, 1.0 - length(vUv * 2.0 - 1.0));
    float alpha = falloff * falloff;
    gl_FragColor = vec4(uColor * vTint * uIntensity, alpha);
  }
`;

export const billboardQuad = new THREE.PlaneGeometry(1, 1);
export const flameQuad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);

export function createFlameMaterial({ core, mid, edge, intensity, midTint = 0 }: FlameColors) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: hallClock.uTime,
      uCore: { value: new THREE.Color(core) },
      uMid: { value: new THREE.Color(mid) },
      uEdge: { value: new THREE.Color(edge) },
      uIntensity: { value: intensity },
      uMidTint: { value: midTint },
    },
    vertexShader: flameVertex,
    fragmentShader: flameFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function createGlowMaterial({ color, intensity, pulse }: GlowOptions) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: hallClock.uTime,
      uPulse: { value: pulse },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
    },
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
