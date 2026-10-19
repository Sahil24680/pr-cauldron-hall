import * as THREE from "three";

export type CrystalShape = "bead" | "diamond" | "teardrop" | "prism";

const FACETS = { bead: 4, diamond: 8, teardrop: 7, prism: 6 } as const;

function lathe(profile: [number, number][], facets: number) {
  return new THREE.LatheGeometry(
    profile.map(([radius, y]) => new THREE.Vector2(radius, y)),
    facets,
  );
}

// Unit-sized cut-glass shapes hanging from their top (y = 0) so they can be strung by their tips.
export const CRYSTAL_SHAPES: Record<CrystalShape, THREE.BufferGeometry> = {
  bead: lathe(
    [
      [0, -1],
      [0.5, -0.5],
      [0, 0],
    ],
    FACETS.bead,
  ),
  diamond: lathe(
    [
      [0, -1],
      [0.52, -0.32],
      [0.38, -0.1],
      [0, -0.05],
    ],
    FACETS.diamond,
  ),
  teardrop: lathe(
    [
      [0, -1],
      [0.32, -0.9],
      [0.42, -0.72],
      [0.3, -0.42],
      [0.12, -0.14],
      [0, 0],
    ],
    FACETS.teardrop,
  ),
  prism: lathe(
    [
      [0, -1],
      [0.18, -0.82],
      [0.18, -0.2],
      [0, 0],
    ],
    FACETS.prism,
  ),
};
