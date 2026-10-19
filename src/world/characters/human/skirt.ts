import * as THREE from "three";
import type { Outfit } from "../wizard/look";
import { trimTilesAround } from "../wizard/trimBand";
import type { BodyLandmarks } from "./landmarks";
import { GARMENT_GROUP } from "./materialGroups";
import { paintWhite, wrapUv } from "./shell";

const SKIRT = {
  waistRadius: 0.17,
  hipRadius: 0.25,
  depthRatio: 0.92,
  centerZ: -0.03,
  rings: 18,
  segments: 40,
  hemBand: 0.06,
  maxLegShare: 0.8,
  panelHalfAngle: 0.32,
};
const SKIRT_HEM: Record<Outfit, { y: number; radius: number; frontGap: number }> = {
  robe: { y: 0.07, radius: 0.34, frontGap: 0 },
  coat: { y: 0.5, radius: 0.27, frontGap: 0.5 },
  longcoat: { y: 0.27, radius: 0.31, frontGap: 0.7 },
};

export const SKIRT_WAIST = { radius: SKIRT.waistRadius, depthRatio: SKIRT.depthRatio, centerZ: SKIRT.centerZ };

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function frontAngle(angle: number) {
  return Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
}

function skirtGroup(aboveHem: number, angle: number) {
  if (aboveHem < SKIRT.hemBand) {
    return GARMENT_GROUP.trim;
  }
  return frontAngle(angle) < SKIRT.panelHalfAngle ? GARMENT_GROUP.panel : GARMENT_GROUP.fabric;
}

// A bell of cloth from waist to hem, weighted to the pelvis at the top and increasingly to the nearer thigh below,
// so it swings with each stride and folds forward when the wearer sits on a broom.
export function buildSkirt(outfit: Outfit, bones: THREE.Bone[], landmarks: BodyLandmarks, bulk: number) {
  const hem = SKIRT_HEM[outfit];
  const boneIndex = (name: string) =>
    Math.max(
      0,
      bones.findIndex((bone) => bone.name === name),
    );
  const pelvis = boneIndex("pelvis");
  const thighLeft = boneIndex("thigh_l");
  const thighRight = boneIndex("thigh_r");
  const gapStart = hem.frontGap / 2;
  const sweep = Math.PI * 2 - hem.frontGap;
  const columns = SKIRT.segments + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const { waistY, hipY } = landmarks;
  const radiusAt = (y: number) =>
    bulk +
    (y > hipY
      ? THREE.MathUtils.lerp(SKIRT.hipRadius, SKIRT.waistRadius, (y - hipY) / (waistY - hipY))
      : THREE.MathUtils.lerp(hem.radius, SKIRT.hipRadius, (y - hem.y) / (hipY - hem.y)));

  const ringY = (ring: number) => THREE.MathUtils.lerp(waistY, hem.y, ring / SKIRT.rings);
  const bandTopRing = Array.from({ length: SKIRT.rings }, (_, ring) => ring).find((ring) => ringY(ring + 1) - hem.y < SKIRT.hemBand) ?? SKIRT.rings;
  const bandHeight = ringY(bandTopRing) - hem.y;
  const bandTiles = trimTilesAround(sweep * hem.radius, bandHeight);
  // The hem band's rings are laid down a second time after the rest, with UVs that run the embroidery round the hem.
  const ringsLaid = [
    ...Array.from({ length: SKIRT.rings + 1 }, (_, ring) => ({ ring, band: false })),
    ...Array.from({ length: SKIRT.rings + 1 - bandTopRing }, (_, offset) => ({ ring: bandTopRing + offset, band: true })),
  ];
  for (const { ring, band } of ringsLaid) {
    const down = ring / SKIRT.rings;
    const y = ringY(ring);
    const radius = radiusAt(y);
    const legShare = smoothstep(0.08, 0.55, down) * SKIRT.maxLegShare;
    for (let column = 0; column < columns; column++) {
      const angle = gapStart + (column / SKIRT.segments) * sweep;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius * SKIRT.depthRatio + SKIRT.centerZ;
      const leftShare = smoothstep(-0.45, 0.45, x / radius);
      positions.push(x, y, z);
      uvs.push(...(band ? [(column / SKIRT.segments) * bandTiles, (y - hem.y) / bandHeight] : wrapUv(angle, y)));
      skinIndices.push(pelvis, thighLeft, thighRight, 0);
      skinWeights.push(1 - legShare, legShare * leftShare, legShare * (1 - leftShare), 0);
    }
  }

  const bandStart = (SKIRT.rings + 1 - bandTopRing) * columns;
  const groups: number[][] = [[], [], []];
  for (let ring = 0; ring < SKIRT.rings; ring++) {
    for (let column = 0; column < SKIRT.segments; column++) {
      const middle = gapStart + ((column + 0.5) / SKIRT.segments) * sweep;
      const group = skirtGroup(ringY(ring + 1) - hem.y, middle);
      const a = (group === GARMENT_GROUP.trim ? bandStart : 0) + ring * columns + column;
      const b = a + columns;
      groups[group]?.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(groups.flat());
  let start = 0;
  groups.forEach((group, materialIndex) => {
    geometry.addGroup(start, group.length, materialIndex);
    start += group.length;
  });
  geometry.computeVertexNormals();
  return paintWhite(geometry);
}
