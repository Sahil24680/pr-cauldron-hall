import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

export type BillboardSize = [number, number];

type Props = {
  at: THREE.Vector3[];
  sizes: BillboardSize[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  tints?: THREE.Color[];
};

export function Billboards({ at, sizes, geometry, material, tints }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const instances = mesh.current;
    if (!instances) {
      return;
    }
    const matrix = new THREE.Matrix4();
    at.forEach((position, index) => {
      const [width, height] = sizes[index % sizes.length] ?? [1, 1];
      instances.setMatrixAt(index, matrix.makeScale(width, height, 1).setPosition(position));
      const tint = tints?.[index % tints.length];
      if (tint) {
        instances.setColorAt(index, tint);
      }
    });
    instances.instanceMatrix.needsUpdate = true;
    if (instances.instanceColor) {
      instances.instanceColor.needsUpdate = true;
    }
  }, [at, sizes, tints]);
  return <instancedMesh ref={mesh} args={[geometry, material, at.length]} frustumCulled={false} />;
}
