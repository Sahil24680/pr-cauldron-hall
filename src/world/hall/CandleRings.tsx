import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { billboardQuad, flameQuad } from "./glowShaders";
import { candleFlame, candleHalo, candleWax } from "./materials";

type Props = { centers: THREE.Vector3[] };

const CANDLES_PER_RING = 6;
const RING_RADIUS = 1.7;
const ORBIT_RATE = 0.12;
const BOB = 0.08;
const BOB_RATE = 0.9;
const TILT = 0.04;
const CANDLE_SIZE = new THREE.Vector3(0.08, 0.34, 0.08);
const FLAME_SIZE = new THREE.Vector2(0.065, 0.16);
const HALO_SIZE = 0.4;
const WICK_HEIGHT = 0.175;

const stick = new THREE.CylinderGeometry(0.5, 0.52, 1, 10);

// Each chandelier keeps a small retinue of candles circling it, the only candles that fly in the hall.
export function CandleRings({ centers }: Props) {
  const count = centers.length * CANDLES_PER_RING;
  const wax = useRef<THREE.InstancedMesh>(null);
  const flames = useRef<THREE.InstancedMesh>(null);
  const halos = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(
    () => ({ matrix: new THREE.Matrix4(), turn: new THREE.Quaternion(), tilt: new THREE.Euler(), at: new THREE.Vector3(), wick: new THREE.Vector3() }),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { matrix, turn, tilt, at, wick } = scratch;
    centers.forEach((center, ring) => {
      const direction = ring % 2 === 0 ? 1 : -1;
      for (let candle = 0; candle < CANDLES_PER_RING; candle++) {
        const index = ring * CANDLES_PER_RING + candle;
        const angle = (candle / CANDLES_PER_RING) * Math.PI * 2 + t * ORBIT_RATE * direction;
        const phase = index * 1.3;
        at.set(center.x + Math.cos(angle) * RING_RADIUS, center.y + Math.sin(t * BOB_RATE + phase) * BOB, center.z + Math.sin(angle) * RING_RADIUS);
        turn.setFromEuler(tilt.set(Math.sin(t * 0.6 + phase) * TILT, 0, Math.cos(t * 0.5 + phase) * TILT));
        wax.current?.setMatrixAt(index, matrix.compose(at, turn, CANDLE_SIZE));
        wick.set(0, WICK_HEIGHT, 0).applyQuaternion(turn).add(at);
        flames.current?.setMatrixAt(index, matrix.makeScale(FLAME_SIZE.x, FLAME_SIZE.y, 1).setPosition(wick));
        halos.current?.setMatrixAt(index, matrix.makeScale(HALO_SIZE, HALO_SIZE, 1).setPosition(wick.x, wick.y + FLAME_SIZE.y / 2, wick.z));
      }
    });
    for (const mesh of [wax.current, flames.current, halos.current]) {
      if (mesh) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <>
      <instancedMesh ref={wax} args={[stick, candleWax, count]} frustumCulled={false} />
      <instancedMesh ref={flames} args={[flameQuad, candleFlame, count]} frustumCulled={false} />
      <instancedMesh ref={halos} args={[billboardQuad, candleHalo, count]} frustumCulled={false} />
    </>
  );
}
