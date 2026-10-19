import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { garmentsFor } from "./garments";
import type { BodyLandmarks } from "./landmarks";
import { GARMENT_GROUP } from "./materialGroups";
import { skinnedStrip, testSkeleton } from "./testSkeleton";

const LEG = 2;
const ROW_HEIGHT = 0.1;
const LANDMARKS: BodyLandmarks = { waistY: 1.05, hipY: 0.9, chestY: 1.25, neckBaseY: 1.5, shoulderY: 1.4, elbowX: 0.4, wristX: 0.6 };

function legOnlyBody() {
  const skeleton = testSkeleton();
  const body = new THREE.SkinnedMesh(skinnedStrip([LEG, LEG, LEG, LEG, LEG, LEG, LEG, LEG], ROW_HEIGHT), new THREE.MeshBasicMaterial());
  body.bind(skeleton);
  return body;
}

describe("garmentsFor trousers", () => {
  it("carries the trousers down inside the boots in boot leather", () => {
    const { trousers } = garmentsFor("test:leg", legOnlyBody(), "robe", LANDMARKS, 1);
    const inBoot = trousers.groups.find((group) => group.materialIndex === GARMENT_GROUP.inBoot);
    expect(inBoot?.count).toBeGreaterThan(0);
    expect(trousers.groups.find((group) => group.materialIndex === GARMENT_GROUP.fabric)?.count).toBeGreaterThan(0);
  });
});
