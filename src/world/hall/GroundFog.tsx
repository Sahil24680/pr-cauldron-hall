import { useMemo } from "react";
import * as THREE from "three";
import { FRONT_EDGE_Z, HALL_HALF_WIDTH } from "../layout";
import { merged, placed } from "./geometryKit";
import { hallClock } from "./hallClock";

type Props = { backZ: number };

// Kept to the wall margins and the back of the hall, where no wizard ever stands, so it never slices through a robe.
const SIDE_MARGIN = 2;
const BACK_MARGIN = 3.2;
const LAYERS = [
  { y: 0.06, opacity: 0.3 },
  { y: 0.18, opacity: 0.2 },
  { y: 0.32, opacity: 0.1 },
];

const fogVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fogFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vWorld;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), u.x), mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float sum = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 4; octave++) {
      sum += noise(p) * amplitude;
      p *= 2.1;
      amplitude *= 0.5;
    }
    return sum;
  }
  void main() {
    vec2 drift = vWorld.xz * 0.45 + vec2(uTime * 0.05, uTime * 0.03);
    float wisps = fbm(drift + fbm(drift * 0.7 - uTime * 0.02) * 1.5);
    float edges = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
    gl_FragColor = vec4(uColor, smoothstep(0.35, 0.85, wisps) * edges * uOpacity);
  }
`;

function fogMaterial(opacity: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: hallClock.uTime, uOpacity: { value: opacity }, uColor: { value: new THREE.Color("#8a96b8") } },
    vertexShader: fogVertex,
    fragmentShader: fogFragment,
    transparent: true,
    depthWrite: false,
  });
}

const layerMaterials = LAYERS.map((layer) => fogMaterial(layer.opacity));

export function GroundFog({ backZ }: Props) {
  const sheet = useMemo(() => {
    const depth = FRONT_EDGE_Z - backZ;
    const centerZ = (FRONT_EDGE_Z + backZ) / 2;
    const flat = (width: number, length: number) => new THREE.PlaneGeometry(width, length).rotateX(-Math.PI / 2);
    const pieces = [-1, 1].map((side) =>
      placed(flat(SIDE_MARGIN, depth), new THREE.Matrix4().makeTranslation(side * (HALL_HALF_WIDTH - SIDE_MARGIN / 2), 0, centerZ)),
    );
    pieces.push(placed(flat(HALL_HALF_WIDTH * 2, BACK_MARGIN), new THREE.Matrix4().makeTranslation(0, 0, backZ + BACK_MARGIN / 2)));
    return merged(pieces);
  }, [backZ]);
  return (
    <group>
      {LAYERS.map((layer, index) => (
        <mesh key={layer.y} geometry={sheet} material={layerMaterials[index]} position={[0, layer.y, 0]} renderOrder={1} />
      ))}
    </group>
  );
}
