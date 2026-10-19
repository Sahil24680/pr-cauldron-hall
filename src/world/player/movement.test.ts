import { describe, expect, it } from "vitest";
import { facingForTravel, shortestTurn, travelDirection, turnToward } from "./movement";

describe("travelDirection", () => {
  it("steers relative to the view: forward is where it faces, right is to its right", () => {
    const facingPlusX = Math.PI / 2;
    expect(travelDirection(facingPlusX, 1, 0)?.x).toBeCloseTo(1);
    const right = travelDirection(0, 0, 1);
    expect(right?.x).toBeCloseTo(-1);
    expect(right?.z).toBeCloseTo(0);
  });

  it("keeps diagonals the same speed and returns nothing when no key steers", () => {
    const diagonal = travelDirection(0.3, 1, 1);
    expect(Math.hypot(diagonal?.x ?? 0, diagonal?.z ?? 0)).toBeCloseTo(1);
    expect(travelDirection(0, 0, 0)).toBeNull();
  });
});

describe("turnToward", () => {
  it("turns the short way across the seam at a half turn", () => {
    expect(shortestTurn(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(turnToward(3, -3, 1)).toBeCloseTo(3 + (2 * Math.PI - 6));
  });

  it("moves only the given share of the way", () => {
    expect(turnToward(0, 1, 0.25)).toBeCloseTo(0.25);
  });
});

describe("facingForTravel", () => {
  it("faces where the wizard walks when going forward or sideways", () => {
    expect(facingForTravel(0, 1, 0)).toBeCloseTo(0);
    expect(Math.abs(facingForTravel(0, 0, 1) ?? 0)).toBeCloseTo(Math.PI / 2);
  });

  it("keeps facing away from the camera when backing up, so the wizard backpedals", () => {
    expect(facingForTravel(0.4, -1, 0)).toBeCloseTo(0.4);
  });

  it("holds the current facing when standing still", () => {
    expect(facingForTravel(0, 0, 0)).toBeNull();
  });
});
