import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { dominantRegions, extractShell, regionOf, weldGroups } from "./shell";
import { skinnedStrip, testSkeleton } from "./testSkeleton";

const TORSO = 0;
const ARM = 1;
const HEAD = 4;

describe("regionOf", () => {
  it("sorts the Unreal mannequin bones into body regions", () => {
    expect(regionOf("Head")).toBe("head");
    expect(regionOf("index_02_l")).toBe("hand");
    expect(regionOf("lowerarm_r")).toBe("arm");
    expect(regionOf("calf_l")).toBe("leg");
    expect(regionOf("ball_r")).toBe("foot");
    expect(regionOf("spine_03")).toBe("torso");
  });
});

describe("weldGroups", () => {
  it("gives seam duplicates at the same position one group", () => {
    const { groupOf, count } = weldGroups([0, 0, 0, 1, 0, 0, 0, 0, 0]);
    expect(count).toBe(2);
    expect(groupOf[0]).toBe(groupOf[2]);
  });
});

describe("extractShell", () => {
  const skeleton = testSkeleton();
  const body = skinnedStrip([TORSO, TORSO, TORSO, HEAD, HEAD]);
  const regions = dominantRegions(body, skeleton.bones);
  const shell = (offset: number, group = () => 0) =>
    extractShell(body, regions, { keep: (_, region) => region === "torso", offset: () => offset, group, smoothing: 0, uv: () => [0, 0] });

  it("keeps only triangles whose three corners the garment covers", () => {
    expect(shell(0).getIndex()?.count).toBe(12);
  });

  it("pushes the cloth out along the body's normals", () => {
    const position = shell(0.02).getAttribute("position");
    for (let vertex = 0; vertex < position.count; vertex++) {
      expect(position.getZ(vertex)).toBeCloseTo(0.02);
    }
  });

  it("orders triangles by material group and records each group", () => {
    const geometry = shell(0, () => 1);
    expect(geometry.groups).toEqual([{ start: 0, count: 12, materialIndex: 1 }]);
  });

  it("carries the body's skin weights and a white vertex colour", () => {
    const geometry = shell(0);
    expect(geometry.getAttribute("skinIndex").getX(0)).toBe(TORSO);
    expect(geometry.getAttribute("color").getX(0)).toBe(1);
  });

  it("never lets relaxing pull the cloth inside the skin", () => {
    const bumpy = skinnedStrip([TORSO, TORSO, TORSO, TORSO]);
    bumpy.getAttribute("position").setZ(4, 0.05);
    bumpy.getAttribute("position").setZ(5, 0.05);
    const relaxed = extractShell(bumpy, dominantRegions(bumpy, skeleton.bones), {
      keep: () => true,
      offset: () => 0,
      group: () => 0,
      smoothing: 8,
      uv: () => [0, 0],
    });
    const position = relaxed.getAttribute("position");
    expect(position.getZ(4)).toBeGreaterThanOrEqual(0.05 - 1e-6);
    expect(new THREE.Vector3().fromBufferAttribute(position, 0).z).toBeGreaterThanOrEqual(-1e-6);
  });
});

describe("dominantRegions", () => {
  it("labels each vertex by its heaviest bone", () => {
    const skeleton = testSkeleton();
    expect(dominantRegions(skinnedStrip([ARM, HEAD]), skeleton.bones)).toEqual(["arm", "arm", "head", "head"]);
  });
});
