import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { BodyLandmarks } from "./landmarks";
import { GARMENT_GROUP } from "./materialGroups";
import { buildSkirt } from "./skirt";

const LANDMARKS: BodyLandmarks = { waistY: 1.05, hipY: 0.92, chestY: 1.23, neckBaseY: 1.47, shoulderY: 1.455, elbowX: 0.46, wristX: 0.7 };
const bones = ["pelvis", "thigh_l", "thigh_r"].map((name) => Object.assign(new THREE.Bone(), { name }));

function frontmostZ(geometry: THREE.BufferGeometry, nearY: number) {
  const position = geometry.getAttribute("position");
  let front = Number.NEGATIVE_INFINITY;
  for (let vertex = 0; vertex < position.count; vertex++) {
    if (Math.abs(position.getY(vertex) - nearY) < 0.05 && Math.abs(position.getX(vertex)) < 0.02) {
      front = Math.max(front, position.getZ(vertex));
    }
  }
  return front;
}

describe("buildSkirt", () => {
  it("gives every vertex skin weights that add up to one", () => {
    const weights = buildSkirt("robe", bones, LANDMARKS, 0).getAttribute("skinWeight");
    for (let vertex = 0; vertex < weights.count; vertex++) {
      const sum = weights.getX(vertex) + weights.getY(vertex) + weights.getZ(vertex) + weights.getW(vertex);
      expect(sum).toBeCloseTo(1);
    }
  });

  it("hangs from the pelvis at the waist and follows the thighs toward the hem", () => {
    const skirt = buildSkirt("robe", bones, LANDMARKS, 0);
    const weights = skirt.getAttribute("skinWeight");
    expect(weights.getX(0)).toBeCloseTo(1);
    expect(weights.getX(weights.count - 1)).toBeLessThan(0.3);
  });

  it("closes a robe at the front but leaves a coat open there", () => {
    expect(frontmostZ(buildSkirt("robe", bones, LANDMARKS, 0), 0.6)).toBeGreaterThan(0.15);
    expect(frontmostZ(buildSkirt("coat", bones, LANDMARKS, 0), 0.6)).toBeLessThan(0);
  });

  it("bands the hem in trim and widens with a broader build", () => {
    const skirt = buildSkirt("robe", bones, LANDMARKS, 0);
    expect(skirt.groups.find((group) => group.materialIndex === GARMENT_GROUP.trim)?.count).toBeGreaterThan(0);
    skirt.computeBoundingBox();
    const broad = buildSkirt("robe", bones, LANDMARKS, 0.02);
    broad.computeBoundingBox();
    expect(broad.boundingBox?.max.x ?? 0).toBeGreaterThan(skirt.boundingBox?.max.x ?? 0);
  });
});
