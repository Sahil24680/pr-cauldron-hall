import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { FRONT_Z, ZONE_SPACING, type Zone } from "../layout";
import { hallReflections } from "../textures";
import { type SigilMark, entranceInlay, sigilTexture } from "./artwork";
import { merged, placed, woodBlock } from "./geometryKit";
import { gold, inlayStone } from "./materials";
import { STAGE_SHADES } from "./stagePalette";

type Props = { zones: Zone[] };

const ENTRANCE_SEAL = { z: 13.2, radius: 2.1 };
const SIGIL = { ahead: 2.45, radius: 0.55 };
const LANE = { width: 0.09, lift: 0.003 };
const INLAY_LIFT = 0.004;
const SIGIL_GLOW = { low: 0.35, high: 0.75, rate: 1.1 };

const seal = new THREE.MeshStandardMaterial({
  map: entranceInlay(),
  transparent: true,
  roughness: 0.5,
  envMap: hallReflections(),
  envMapIntensity: 0.4,
  polygonOffset: true,
  polygonOffsetFactor: -2,
});
const entranceDisc = new THREE.CircleGeometry(ENTRANCE_SEAL.radius, 64).rotateX(-Math.PI / 2);
const sigilDisc = new THREE.CircleGeometry(SIGIL.radius, 48).rotateX(-Math.PI / 2);

function sigilMaterial(glow: string, mark: SigilMark) {
  return new THREE.MeshBasicMaterial({
    map: sigilTexture(mark),
    color: new THREE.Color(glow),
    transparent: true,
    opacity: SIGIL_GLOW.low,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });
}

export function FloorInlays({ zones }: Props) {
  const built = useMemo(() => {
    const front = Math.max(...zones.map((zone) => zone.startZ));
    const back = Math.min(...zones.map((zone) => zone.endZ));
    const lanes: THREE.BufferGeometry[] = [];
    const boundaries = zones.slice(1).map((zone) => zone.x - ZONE_SPACING / 2);
    for (const x of boundaries) {
      lanes.push(placed(woodBlock(LANE.width, LANE.lift, front - back), new THREE.Matrix4().makeTranslation(x, LANE.lift / 2, (front + back) / 2)));
    }
    const rings = zones.map((zone) =>
      placed(
        new THREE.TorusGeometry(SIGIL.radius + 0.04, 0.018, 4, 48).rotateX(Math.PI / 2),
        new THREE.Matrix4().makeTranslation(zone.x, 0.006, FRONT_Z + SIGIL.ahead),
      ),
    );
    const sigils = zones.map((zone) => ({
      stage: zone.stage,
      x: zone.x,
      material: sigilMaterial(STAGE_SHADES[zone.stage].glow, STAGE_SHADES[zone.stage].sigil),
    }));
    return { lanes: merged(lanes), rings: merged(rings), sigils };
  }, [zones]);
  useFrame((state) => {
    built.sigils.forEach((sigil, index) => {
      const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * SIGIL_GLOW.rate + index * 1.7);
      sigil.material.opacity = THREE.MathUtils.lerp(SIGIL_GLOW.low, SIGIL_GLOW.high, pulse);
    });
  });
  return (
    <group>
      <mesh geometry={entranceDisc} material={seal} position={[0, INLAY_LIFT, ENTRANCE_SEAL.z]} />
      <mesh geometry={built.lanes} material={inlayStone} />
      <mesh geometry={built.rings} material={gold} />
      {built.sigils.map((sigil) => (
        <mesh key={sigil.stage} geometry={sigilDisc} material={sigil.material} position={[sigil.x, INLAY_LIFT * 1.5, FRONT_Z + SIGIL.ahead]} />
      ))}
    </group>
  );
}
