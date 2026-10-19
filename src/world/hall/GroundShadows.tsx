import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { radialGlow } from "../textures";

export type GroundShadow = { x: number; z: number; width: number; depth: number };

type Props = { shadows: GroundShadow[] };

const SHADOW_LIFT = 0.006;
const SHADOW_STRENGTH = 0.55;

const blot = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const darkening = new THREE.MeshBasicMaterial({ color: "#000000", alphaMap: radialGlow(), transparent: true, opacity: SHADOW_STRENGTH, depthWrite: false });

// Soft contact darkening under heavy furniture: the hall renders without shadow maps, so this is what grounds them.
export function GroundShadows({ shadows }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const instances = mesh.current;
    if (!instances) {
      return;
    }
    const matrix = new THREE.Matrix4();
    shadows.forEach((shadow, index) => {
      instances.setMatrixAt(index, matrix.makeScale(shadow.width, 1, shadow.depth).setPosition(shadow.x, SHADOW_LIFT, shadow.z));
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingSphere();
  }, [shadows]);
  return <instancedMesh ref={mesh} args={[blot, darkening, shadows.length]} renderOrder={1} />;
}
