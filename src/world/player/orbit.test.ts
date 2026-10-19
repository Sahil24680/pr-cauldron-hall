import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { hallBounds } from "../layout";
import { cameraBox, playerBounds } from "./camera";
import { clearDistance, shoulderPivot, solidsFromFootprints, viewForward } from "./orbit";

const bounds = hallBounds(-20, 0.6);
const hall = cameraBox(bounds);
const cauldron = solidsFromFootprints([{ minX: -0.6, maxX: 0.6, minZ: 2.4, maxZ: 3.6 }]);

describe("clearDistance", () => {
  it("allows the full boom in open floor", () => {
    expect(clearDistance(new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(0, 0, -1), 4, hall, [])).toBe(4);
  });

  it("stops short of the side-wall pillars and bookcases", () => {
    const head = new THREE.Vector3(playerBounds(bounds).maxX, 1.7, 0);
    const distance = clearDistance(head, new THREE.Vector3(1, 0, 0), 4, hall, []);
    expect(head.x + distance).toBeCloseTo(hall.maxX);
    expect(distance).toBeLessThan(0.2);
  });

  it("stops above the floor when looking up from low", () => {
    const downAndBack = viewForward(0, 0.5).negate();
    const distance = clearDistance(new THREE.Vector3(0, 1.7, 0), downAndBack, 7, hall, []);
    expect(1.7 + downAndBack.y * distance).toBeCloseTo(hall.minY);
  });

  it("stops in front of a cauldron behind the wizard", () => {
    const distance = clearDistance(new THREE.Vector3(0, 0.8, 0), new THREE.Vector3(0, 0, 1), 6, hall, cauldron);
    expect(distance).toBeCloseTo(2.4 - 0.25);
  });

  it("ignores a cauldron the pivot is already inside", () => {
    expect(clearDistance(new THREE.Vector3(0, 0.8, 3), new THREE.Vector3(0, 0, -1), 2, hall, cauldron)).toBe(2);
  });
});

describe("shoulderPivot", () => {
  it("sits right of the head, but never inside the wall beside it", () => {
    const open = shoulderPivot(new THREE.Vector3(0, 1.7, 0), 0, hall, []);
    expect(open.x).toBeCloseTo(-0.45);
    const beside = shoulderPivot(new THREE.Vector3(hall.minX + 0.1, 1.7, 0), 0, hall, []);
    expect(beside.x).toBeCloseTo(hall.minX);
  });
});
