import { describe, expect, it } from "vitest";
import { BUBBLE_POP_AT, SMOKE_RISE, bubbleAt, smokePuffAt } from "./brewMotion";

const SAMPLES = Array.from({ length: 21 }, (_, index) => index / 20);

describe("smokePuffAt", () => {
  it("starts and ends invisible so puffs never pop in or out", () => {
    expect(smokePuffAt(0).opacity).toBe(0);
    expect(smokePuffAt(1).opacity).toBe(0);
    expect(smokePuffAt(0.3).opacity).toBeGreaterThan(0.5);
  });

  it("rises and swells steadily, never past its ceiling", () => {
    const puffs = SAMPLES.map(smokePuffAt);
    puffs.slice(1).forEach((puff, index) => {
      expect(puff.rise).toBeGreaterThan(puffs[index]?.rise ?? Number.POSITIVE_INFINITY);
      expect(puff.size).toBeGreaterThan(puffs[index]?.size ?? Number.POSITIVE_INFINITY);
    });
    expect(Math.max(...puffs.map((puff) => puff.rise))).toBeCloseTo(SMOKE_RISE);
  });
});

describe("bubbleAt", () => {
  it("swells through the surface without flashing until it pops", () => {
    expect(bubbleAt(0).lift).toBeLessThan(0);
    expect(bubbleAt(BUBBLE_POP_AT - 0.01).lift).toBeGreaterThan(0);
    expect(bubbleAt(BUBBLE_POP_AT - 0.01).flash).toBe(0);
    expect(bubbleAt(0.2).size).toBeLessThan(bubbleAt(0.6).size);
  });

  it("vanishes at the pop and leaves a flash that fades out", () => {
    expect(bubbleAt(BUBBLE_POP_AT).size).toBe(0);
    expect(bubbleAt(BUBBLE_POP_AT).flash).toBe(1);
    expect(bubbleAt(0.999).flash).toBeLessThan(0.01);
  });
});
