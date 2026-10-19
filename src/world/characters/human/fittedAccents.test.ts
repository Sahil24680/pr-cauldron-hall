import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { blendedInfluence, offsetLoop, sectionOutline } from "./fittedAccents";

const BINS = 72;
const angleOf = ([u, v]: readonly [number, number]) => (Math.atan2(v, u) + Math.PI * 2) % (Math.PI * 2);

function circle(radius: number, count: number, skip: (angle: number) => boolean = () => false) {
  return Array.from({ length: count }, (_, step) => (step / count) * Math.PI * 2)
    .filter((angle) => !skip(angle))
    .map((angle): [number, number] => [Math.cos(angle) * radius, Math.sin(angle) * radius]);
}

describe("sectionOutline", () => {
  it("bridges a hollow narrower than the bridge and keeps every point inside", () => {
    const notch = (angle: number) => Math.abs(angle - Math.PI / 2) < 0.08;
    const section = [...circle(0.2, 720, notch), ...circle(0.1, 40).filter(([u, v]) => notch(angleOf([u, v])))];

    const outline = sectionOutline(section, BINS, 4);

    for (const point of outline) {
      expect(Math.hypot(...point)).toBeGreaterThanOrEqual(0.2 - 1e-6);
    }
  });

  it("follows a hollow wider than the bridge", () => {
    const flat = (angle: number) => Math.abs(angle - Math.PI / 2) < 0.6;
    const section = [...circle(0.2, 720, flat), ...circle(0.1, 720).filter(([u, v]) => flat(angleOf([u, v])))];

    const outline = sectionOutline(section, BINS, 2);

    const top = outline.find((point) => Math.abs(angleOf(point) - Math.PI / 2) < 0.05);
    expect(Math.hypot(...(top ?? [0, 0]))).toBeCloseTo(0.1, 2);
  });
});

describe("offsetLoop", () => {
  it("spaces points evenly and pushes them out of a counter-clockwise loop", () => {
    const loop = offsetLoop(circle(1, 360), 0.05, 0.1);

    expect(loop.length).toBe(Math.ceil((Math.PI * 2) / 0.05));
    for (const { at, outward } of loop) {
      expect(Math.hypot(...at)).toBeCloseTo(1.1, 3);
      expect(outward[0] * at[0] + outward[1] * at[1]).toBeGreaterThan(0);
    }
  });
});

describe("blendedInfluence", () => {
  const influences = [
    { at: new THREE.Vector3(0, 1, 0), joints: [3, 0, 0, 0], weights: [1, 0, 0, 0] },
    { at: new THREE.Vector3(0.04, 1, 0), joints: [5, 0, 0, 0], weights: [1, 0, 0, 0] },
  ];
  const weightOf = (influence: { joints: number[]; weights: number[] }, joint: number) => influence.weights[influence.joints.indexOf(joint)] ?? 0;

  it("shares the weights of points equally far away", () => {
    const halfway = blendedInfluence(influences)(new THREE.Vector3(0.02, 1, 0));
    expect(weightOf(halfway, 3)).toBeCloseTo(0.5, 5);
    expect(weightOf(halfway, 5)).toBeCloseTo(0.5, 5);
  });

  it("leans toward the nearer point and keeps the weights summing to one", () => {
    const near = blendedInfluence(influences)(new THREE.Vector3(0.005, 1, 0));
    expect(weightOf(near, 3)).toBeGreaterThan(weightOf(near, 5));
    expect(near.weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 5);
  });
});
