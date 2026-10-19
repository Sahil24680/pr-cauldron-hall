import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { keepBehind, pushOutOfCapsule, pushOutOfColumn } from "./capeBody";

const torso = { start: new THREE.Vector3(0, 1, 0), end: new THREE.Vector3(0, 2, 0), radius: 0.2 };

describe("pushOutOfCapsule", () => {
  it("moves a point inside the capsule out to its surface, straight away from the bone", () => {
    const point = new THREE.Vector3(0, 1.5, -0.1);
    expect(pushOutOfCapsule(point, torso)).toBe(true);
    expect(point.z).toBeCloseTo(-0.2);
    expect(point.y).toBeCloseTo(1.5);
  });

  it("rounds the ends, pushing a point under the bottom cap downward", () => {
    const point = new THREE.Vector3(0, 0.95, 0);
    pushOutOfCapsule(point, torso);
    expect(point.y).toBeCloseTo(0.8);
  });

  it("leaves points outside alone", () => {
    const point = new THREE.Vector3(0.5, 1.5, 0);
    expect(pushOutOfCapsule(point, torso)).toBe(false);
    expect(point.x).toBe(0.5);
  });
});

describe("pushOutOfColumn", () => {
  it("keeps cloth outside the skirt's radius around the hips", () => {
    const point = new THREE.Vector3(0.1, 0.5, 0);
    pushOutOfColumn(point, new THREE.Vector3(0, 1, 0), 0.3);
    expect(point.x).toBeCloseTo(0.3);
    expect(point.y).toBe(0.5);
  });
});

describe("keepBehind", () => {
  it("stops cloth passing in front of the body", () => {
    const point = new THREE.Vector3(0, 1, 0.4);
    keepBehind(point, new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 0, 1), 0.02);
    expect(point.z).toBeCloseTo(0.02);
  });
});
