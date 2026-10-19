import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { measureLandmarks } from "./landmarks";

function boneAt(name: string, x: number, y: number) {
  const bone = Object.assign(new THREE.Bone(), { name });
  bone.position.set(x, y, 0);
  bone.updateMatrixWorld();
  return bone;
}

describe("measureLandmarks", () => {
  it("reads garment landmarks from the skeleton's bind pose", () => {
    const skeleton = new THREE.Skeleton([
      boneAt("spine_01", 0, 1.07),
      boneAt("pelvis", 0, 0.95),
      boneAt("spine_03", 0, 1.31),
      boneAt("neck_01", 0, 1.52),
      boneAt("lowerarm_l", 0.46, 1.455),
      boneAt("hand_l", 0.706, 1.455),
    ]);
    const landmarks = measureLandmarks(skeleton);
    expect(landmarks.waistY).toBeCloseTo(1.05);
    expect(landmarks.hipY).toBeCloseTo(0.92);
    expect(landmarks.elbowX).toBeCloseTo(0.46);
    expect(landmarks.wristX).toBeCloseTo(0.7);
    expect(landmarks.shoulderY).toBeCloseTo(1.455);
  });
});
