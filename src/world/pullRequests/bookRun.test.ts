import { describe, expect, it } from "vitest";
import type { BookRun } from "../layout";
import { BOOK_CARRY_SPEED, carrierAt } from "./bookRun";

const run: BookRun = { pickup: { spot: { x: 0, z: 0 }, facing: Math.PI }, drop: { spot: { x: 0, z: 2.2 }, facing: 0 } };
const walkSeconds = 2.2 / BOOK_CARRY_SPEED;

describe("carrierAt", () => {
  it("walks the book from the lectern toward the cauldron", () => {
    const pose = carrierAt(run, walkSeconds / 2);
    expect(pose.motion).toBe("walk");
    expect(pose.carrying).toBe(true);
    expect(pose.at.z).toBeCloseTo(1.1);
    expect(pose.facing).toBeCloseTo(0);
  });

  it("brews at the cauldron, then walks back empty handed", () => {
    expect(carrierAt(run, walkSeconds + 0.1)).toMatchObject({ motion: "brew", carrying: false, at: run.drop.spot });
    const returning = carrierAt(run, walkSeconds * 1.5 + 2.4);
    expect(returning).toMatchObject({ motion: "walk", carrying: false });
    expect(Math.abs(returning.facing)).toBeCloseTo(Math.PI);
  });

  it("waits at the lectern and loops forever", () => {
    const roundTrip = walkSeconds * 2 + 2.4 + 1.6;
    expect(carrierAt(run, roundTrip - 0.1)).toMatchObject({ motion: "idle", at: run.pickup.spot });
    expect(carrierAt(run, roundTrip * 3 + 0.2).carrying).toBe(true);
  });
});
