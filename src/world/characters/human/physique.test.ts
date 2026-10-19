import { describe, expect, it } from "vitest";
import { PHYSIQUE_BULK, reshapeBody } from "./physique";
import { skinnedStrip, testSkeleton } from "./testSkeleton";

const TORSO = 0;
const FOOT = 3;
const HEAD = 4;

describe("reshapeBody", () => {
  const skeleton = testSkeleton();

  it("drops triangles that sit entirely inside the boots", () => {
    const body = skinnedStrip([TORSO, TORSO, FOOT, FOOT]);
    expect(reshapeBody(body, skeleton.bones, PHYSIQUE_BULK.average).getIndex()?.count).toBe(12);
  });

  it("pushes torso out for a broad build but leaves the head its own shape", () => {
    const body = skinnedStrip([TORSO, TORSO, HEAD, HEAD]);
    const position = reshapeBody(body, skeleton.bones, PHYSIQUE_BULK.broad).getAttribute("position");
    expect(position.getZ(0)).toBeCloseTo(PHYSIQUE_BULK.broad);
    expect(position.getZ(6)).toBeCloseTo(0);
  });

  it("shares every attribute except positions with the source, so joint indices stay intact", () => {
    const body = skinnedStrip([TORSO, TORSO, HEAD]);
    const reshaped = reshapeBody(body, skeleton.bones, PHYSIQUE_BULK.slender);
    expect(reshaped.getAttribute("skinIndex")).toBe(body.getAttribute("skinIndex"));
    expect(reshaped.getAttribute("position")).not.toBe(body.getAttribute("position"));
  });
});
