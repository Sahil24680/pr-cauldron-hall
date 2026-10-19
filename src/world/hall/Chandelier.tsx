import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { HALL_HALF_WIDTH } from "../layout";
import { useCameraBlocker } from "../player/cameraBlockers";
import { crystalCaustics } from "../textures";
import { type BillboardSize, Billboards } from "./Billboards";
import { chandelierParts } from "./chandelierParts";
import { billboardQuad, createGlowMaterial, flameQuad } from "./glowShaders";
import { candleFlame, candleHalo, candleWax, crystal, gold, silver } from "./materials";
import { createDriftGeometry, createDriftMaterial } from "./particles";

type Props = { x: number; z: number; hookY: number; bodyY: number };

const SWAY_ANGLE = 0.014;
const SWAY_RATE = 0.42;
const SPIN_RATE = 0.035;
const LIGHT_INTENSITY = 10;
const LIGHT_DISTANCE = 12;
const LIGHT_DROP = 0.25;
const FLAME_SIZES: BillboardSize[] = [[0.07, 0.16]];
const CANDLE_HALO_SIZES: BillboardSize[] = [[0.32, 0.32]];
const ORB_HALO_SIZES: BillboardSize[] = [[0.42, 0.42]];
const FALLING_SPARKLES = 36;
const SPARKLE_SPREAD = 1.3;
const CAUSTIC_REACH = 5;
const CAUSTIC_SIZE: [number, number] = [8, 3.4];
const CAUSTIC_HEIGHT = 6.6;
const CAUSTIC_DRIFT = 0.004;
const WALL_GAP = 0.04;
const GLINT_COLOR = new THREE.Color(2.6, 2.5, 2.3);

const orbHalo = createGlowMaterial({ color: "#a9b6ff", intensity: 0.7, pulse: 0.14 });
const orbGlass = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.4, 2.4), toneMapped: false });
const glints = createDriftMaterial({
  color: GLINT_COLOR,
  velocity: [0, 0, 0],
  wander: 0,
  life: 3.5,
  size: 0.2,
  opacity: 1,
  twinkle: 1,
  shape: "star",
  additive: true,
});
const fallingSparkles = createDriftMaterial({
  color: "#fff1c9",
  colorEnd: "#c8d8ff",
  velocity: [0, -0.32, 0],
  wander: 0.25,
  life: 7,
  size: 0.05,
  opacity: 0.9,
  twinkle: 0.6,
  shape: "star",
  additive: true,
});
const sparkleSpawn = createDriftGeometry(FALLING_SPARKLES, 5, (random) => {
  const angle = random() * Math.PI * 2;
  const radius = Math.sqrt(random()) * SPARKLE_SPREAD;
  return [Math.cos(angle) * radius, -0.3 - random() * 0.6, Math.sin(angle) * radius];
});

function WallCaustics({ x, hookY }: { x: number; hookY: number }) {
  const side = Math.sign(x);
  const texture = useMemo(() => crystalCaustics().clone(), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    [texture],
  );
  useFrame((state) => {
    texture.offset.x = state.clock.elapsedTime * CAUSTIC_DRIFT * side;
  });
  return (
    <mesh material={material} position={[side * (HALL_HALF_WIDTH - WALL_GAP) - x, CAUSTIC_HEIGHT - hookY, 0]} rotation={[0, -side * (Math.PI / 2), 0]}>
      <planeGeometry args={CAUSTIC_SIZE} />
    </mesh>
  );
}

export function Chandelier({ x, z, hookY, bodyY }: Props) {
  const parts = chandelierParts(hookY - bodyY);
  const glintSpots = useMemo(() => createDriftGeometry(parts.glints.length, 9, (_, index) => parts.glints[index]?.toArray() ?? [0, 0, 0]), [parts]);
  const pivot = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  useCameraBlocker(body);
  const light = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime + x;
    pivot.current?.rotation.set(Math.sin(t * SWAY_RATE) * SWAY_ANGLE, 0, Math.cos(t * SWAY_RATE * 0.8) * SWAY_ANGLE);
    if (body.current) {
      body.current.rotation.y = t * SPIN_RATE;
    }
    if (light.current) {
      light.current.intensity = LIGHT_INTENSITY * (1 + Math.sin(t * 9) * 0.03 + Math.sin(t * 15) * 0.02);
    }
  });
  const drop = bodyY - hookY;
  return (
    <group position={[x, hookY, z]}>
      <group ref={pivot}>
        <group ref={body} position={[0, drop, 0]}>
          <mesh geometry={parts.gold} material={gold} />
          <mesh geometry={parts.silver} material={silver} />
          <mesh geometry={parts.crystals} material={crystal} />
          <mesh geometry={parts.wax} material={candleWax} />
          <mesh geometry={parts.orbs} material={orbGlass} />
          <Billboards at={parts.flames} sizes={FLAME_SIZES} geometry={flameQuad} material={candleFlame} />
          <Billboards at={parts.flames} sizes={CANDLE_HALO_SIZES} geometry={billboardQuad} material={candleHalo} />
          <Billboards at={parts.orbLights} sizes={ORB_HALO_SIZES} geometry={billboardQuad} material={orbHalo} />
          <points geometry={glintSpots} material={glints} frustumCulled={false} />
        </group>
      </group>
      <pointLight ref={light} position={[0, drop - LIGHT_DROP, 0]} distance={LIGHT_DISTANCE} decay={1.6} color="#ffd39a" />
      <points geometry={sparkleSpawn} material={fallingSparkles} position={[0, drop, 0]} frustumCulled={false} />
      {HALL_HALF_WIDTH - Math.abs(x) < CAUSTIC_REACH && <WallCaustics x={x} hookY={hookY} />}
    </group>
  );
}
