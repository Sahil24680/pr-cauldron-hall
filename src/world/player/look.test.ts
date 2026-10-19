import { describe, expect, it } from "vitest";
import { RECENTER_WITHIN, clampPitch, edgePush, recenterYaw, turnView } from "./look";
import { startingPlayer } from "./player";

const NEARLY_STRAIGHT = (89 * Math.PI) / 180;

describe("clampPitch", () => {
  it("lets first person look almost straight up and down, evenly", () => {
    expect(clampPitch(10, "first")).toBeCloseTo(NEARLY_STRAIGHT);
    expect(clampPitch(-10, "first")).toBeCloseTo(-NEARLY_STRAIGHT);
  });

  it("keeps the third-person orbit from flipping over the top or under the floor", () => {
    expect(clampPitch(10, "third")).toBeCloseTo((35 * Math.PI) / 180);
    expect(clampPitch(-10, "third")).toBeCloseTo((-70 * Math.PI) / 180);
  });
});

describe("turnView", () => {
  it("keeps yaw within one turn", () => {
    const player = startingPlayer();
    turnView(player, Math.PI * 3, 0, "first");
    expect(player.yaw).toBeGreaterThanOrEqual(0);
    expect(player.yaw).toBeLessThan(Math.PI * 2);
  });
});

describe("recenterYaw", () => {
  const FRAME = 1 / 60;

  it("leaves a strafe or a backpedal alone", () => {
    expect(recenterYaw(Math.PI / 2, FRAME)).toBe(0);
    expect(recenterYaw(-RECENTER_WITHIN - 0.01, FRAME)).toBe(0);
  });

  it("bends a held diagonal into a wide arc rather than a tight circle", () => {
    const perSecond = recenterYaw(Math.PI / 4, FRAME) / FRAME;
    expect(perSecond).toBeGreaterThan(0);
    expect(3.6 / perSecond).toBeGreaterThan(8);
  });
});

describe("edgePush", () => {
  it("does not turn the view anywhere but the very edge", () => {
    expect(edgePush(0)).toBe(0);
    expect(edgePush(0.9)).toBe(0);
    expect(edgePush(-1)).toBe(-1);
    expect(edgePush(1)).toBe(1);
  });
});
