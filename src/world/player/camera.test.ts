import { describe, expect, it } from "vitest";
import { BASE_FOV, headBob, targetFov } from "./camera";
import { RUN_SPEED, WALK_SPEED } from "./movement";
import { type Player, startingPlayer } from "./player";

function playerAt(change: Partial<Player>): Player {
  return { ...startingPlayer(), ...change };
}

describe("headBob", () => {
  it("bobs more at a sprint than at a walk", () => {
    const stride = Math.PI / 2;
    const walk = headBob(playerAt({ velocityX: WALK_SPEED, stride }), true);
    const sprint = headBob(playerAt({ velocityX: RUN_SPEED, stride }), true);
    expect(walk.lift).toBeGreaterThan(0);
    expect(sprint.lift).toBeGreaterThan(walk.lift);
  });

  it("stays still when turned off, flying, or in the air", () => {
    const moving = { velocityX: RUN_SPEED, stride: Math.PI / 2 };
    expect(headBob(playerAt(moving), false)).toEqual({ lift: 0, sway: 0 });
    expect(headBob(playerAt({ ...moving, flying: true }), true)).toEqual({ lift: 0, sway: 0 });
    expect(headBob(playerAt({ ...moving, y: 0.5 }), true)).toEqual({ lift: 0, sway: 0 });
  });
});

describe("targetFov", () => {
  it("widens only past walking pace", () => {
    expect(targetFov("first", playerAt({ velocityX: WALK_SPEED }))).toBe(BASE_FOV.first);
    expect(targetFov("first", playerAt({ velocityX: RUN_SPEED }))).toBeGreaterThan(BASE_FOV.first);
  });
});
