import * as THREE from "three";

// A tiny skinned strip for geometry tests: one bone per region the garment code tells apart.
export const TEST_BONES = ["spine_01", "upperarm_l", "thigh_l", "foot_l", "Head"] as const;

export function testSkeleton() {
  const bones = TEST_BONES.map((name) => Object.assign(new THREE.Bone(), { name }));
  return new THREE.Skeleton(bones);
}

// A quad strip along +Y facing +Z; row `i` is skinned fully to bone `boneOfRow[i]`.
export function skinnedStrip(boneOfRow: number[], rowHeight = 0.1) {
  const positions: number[] = [];
  const normals: number[] = [];
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  boneOfRow.forEach((bone, row) => {
    for (const x of [-0.1, 0.1]) {
      positions.push(x, row * rowHeight, 0);
      normals.push(0, 0, 1);
      skinIndex.push(bone, 0, 0, 0);
      skinWeight.push(1, 0, 0, 0);
    }
  });
  const index: number[] = [];
  for (let row = 0; row + 1 < boneOfRow.length; row++) {
    const a = row * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
  geometry.setIndex(index);
  return geometry;
}
