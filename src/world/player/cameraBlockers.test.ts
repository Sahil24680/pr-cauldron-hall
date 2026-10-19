import * as THREE from "three";
import { afterEach, describe, expect, it } from "vitest";
import { blockerBoxes, trackBlocker } from "./cameraBlockers";

const untrack: (() => void)[] = [];

function trackedCube() {
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  cube.updateMatrixWorld();
  untrack.push(trackBlocker(cube));
  return cube;
}

afterEach(() => {
  for (const stop of untrack.splice(0)) {
    stop();
  }
});

describe("blockerBoxes", () => {
  it("measures a tracked prop", () => {
    trackedCube();
    expect(blockerBoxes()[0]?.max.x).toBeCloseTo(0.5);
  });

  it("keeps a still prop's box without remeasuring it", () => {
    const cube = trackedCube();
    blockerBoxes();
    cube.geometry.scale(2, 2, 2);
    expect(blockerBoxes()[0]?.max.x).toBeCloseTo(0.5);
  });

  it("remeasures a prop once it moves", () => {
    const cube = trackedCube();
    blockerBoxes();
    cube.position.x = 3;
    cube.updateMatrixWorld();
    expect(blockerBoxes()[0]?.max.x).toBeCloseTo(3.5);
  });

  it("drops a prop once it is untracked", () => {
    trackedCube();
    untrack.splice(0)[0]?.();
    expect(blockerBoxes()).toHaveLength(0);
  });
});
