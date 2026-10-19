import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { reachArm } from "./armReach";

// An arm held straight out along +X from a shoulder at the origin: 0.3 m upper arm, 0.25 m forearm.
function straightArm() {
  const upper = new THREE.Bone();
  const lower = new THREE.Bone();
  const hand = new THREE.Bone();
  lower.position.set(0.3, 0, 0);
  hand.position.set(0.25, 0, 0);
  upper.add(lower);
  lower.add(hand);
  const root = new THREE.Group();
  root.add(upper);
  root.updateMatrixWorld(true);
  return { root, arm: { upper, lower, hand } };
}

function wristOf(hand: THREE.Bone) {
  hand.updateWorldMatrix(true, false);
  return hand.getWorldPosition(new THREE.Vector3());
}

describe("reachArm", () => {
  it("puts the wrist on a goal within reach", () => {
    const { arm } = straightArm();
    const goal = new THREE.Vector3(0.2, -0.3, 0.2);
    reachArm(arm, goal, new THREE.Vector3(0, -1, -1));
    expect(wristOf(arm.hand).distanceTo(goal)).toBeLessThan(1e-3);
  });

  it("bends the elbow toward the pole", () => {
    const { arm } = straightArm();
    reachArm(arm, new THREE.Vector3(0.3, 0, 0.2), new THREE.Vector3(0, -1, 0));
    expect(arm.lower.getWorldPosition(new THREE.Vector3()).y).toBeLessThan(0);
  });

  it("stretches toward a goal out of reach without overshooting the arm's length", () => {
    const { arm } = straightArm();
    reachArm(arm, new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, -1, 0));
    const wrist = wristOf(arm.hand);
    expect(wrist.length()).toBeLessThanOrEqual(0.55);
    expect(wrist.z).toBeGreaterThan(0.5);
  });
});
