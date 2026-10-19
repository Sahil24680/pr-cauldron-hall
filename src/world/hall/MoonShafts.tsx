import { useMemo } from "react";
import * as THREE from "three";
import { HALL_HALF_WIDTH } from "../layout";
import { merged, placed } from "./geometryKit";
import { hallClock } from "./hallClock";
import { createDriftGeometry, createDriftMaterial } from "./particles";

type Props = { bays: number[] };

// Moonlight only enters through the windows on the moon's side (the directional light sits at -x).
const MOON_SIDE = -1;
const SHAFT_START_Y = 4.9;
const SHAFT_LENGTH = 2.9;
const SHAFT_WIDTH = { near: 1.3, far: 2 };
const SHAFT_DIRECTION = new THREE.Vector3(-MOON_SIDE * 0.78, -0.6, 0.14).normalize();
const MOTES_PER_SHAFT = 26;

const shaftVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shaftFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float along = 1.0 - vUv.y;
    float across = max(sin(vUv.x * 3.14159), 0.0);
    float shimmer = 0.85 + 0.15 * sin(uTime * 0.4 + vUv.x * 9.0 + along * 3.0);
    float alpha = pow(across, 1.6) * (1.0 - smoothstep(0.1, 1.0, along)) * smoothstep(0.0, 0.08, along) * shimmer;
    gl_FragColor = vec4(vec3(0.55, 0.65, 1.0) * 0.16, alpha);
  }
`;

const shaftMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: hallClock.uTime },
  vertexShader: shaftVertex,
  fragmentShader: shaftFragment,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
});

const motes = createDriftMaterial({
  color: "#dfe8ff",
  velocity: [0.01, -0.015, 0.008],
  wander: 0.3,
  life: 14,
  size: 0.018,
  opacity: 0.8,
  twinkle: 0.5,
  shape: "soft",
  additive: true,
});

function taperedSheet() {
  const sheet = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);
  const position = sheet.attributes.position;
  if (position) {
    for (let index = 0; index < position.count; index++) {
      const along = -position.getY(index);
      position.setX(index, position.getX(index) * THREE.MathUtils.lerp(SHAFT_WIDTH.near, SHAFT_WIDTH.far, along));
      position.setY(index, -along * SHAFT_LENGTH);
    }
  }
  return sheet;
}

export function MoonShafts({ bays }: Props) {
  const built = useMemo(() => {
    const sheet = taperedSheet();
    const down = new THREE.Vector3(0, -1, 0);
    const pieces: THREE.BufferGeometry[] = [];
    const starts = bays.map((z) => new THREE.Vector3(MOON_SIDE * (HALL_HALF_WIDTH - 0.05), SHAFT_START_Y, z));
    for (const start of starts) {
      const aim = new THREE.Quaternion().setFromUnitVectors(down, SHAFT_DIRECTION);
      for (const roll of [0, Math.PI / 2]) {
        const spin = new THREE.Quaternion().setFromAxisAngle(SHAFT_DIRECTION, roll);
        pieces.push(placed(sheet, new THREE.Matrix4().compose(start, spin.multiply(aim), new THREE.Vector3(1, 1, 1))));
      }
    }
    const dust = createDriftGeometry(starts.length * MOTES_PER_SHAFT, 31, (random, index) => {
      const start = starts[Math.floor(index / MOTES_PER_SHAFT)] ?? new THREE.Vector3();
      const point = start.clone().addScaledVector(SHAFT_DIRECTION, random() * SHAFT_LENGTH * 0.85);
      return [point.x + (random() - 0.5) * 0.6, point.y + (random() - 0.5) * 0.6, point.z + (random() - 0.5) * 1.2];
    });
    return { shafts: merged(pieces), dust };
  }, [bays]);
  return (
    <group>
      <mesh geometry={built.shafts} material={shaftMaterial} renderOrder={2} />
      <points geometry={built.dust} material={motes} frustumCulled={false} />
    </group>
  );
}
