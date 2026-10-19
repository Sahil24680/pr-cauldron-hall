import { describe, expect, it } from "vitest";
import { GROUNDED, landingBeatFor, motionFor, trackAirBeat } from "./avatarMotion";
import { RUN_SPEED, WALK_SPEED } from "./movement";
import { startingPlayer } from "./player";

const FRAME = 1 / 60;

describe("motionFor", () => {
  const grounded = startingPlayer();

  it("levitates once flight has mostly blended in", () => {
    expect(motionFor(grounded, 0.8, 0, GROUNDED)).toBe("levitate");
  });

  it("takes off, then hangs in the air while off the ground", () => {
    const leaving = { ...GROUNDED, secondsInAir: FRAME };
    expect(motionFor({ ...grounded, y: 0.1 }, 0, 0, leaving)).toBe("jump");
    expect(motionFor({ ...grounded, y: 0.4 }, 0, 0, { ...leaving, secondsInAir: 0.4 })).toBe("airborne");
  });

  it("lands for the landing beat, then moves on", () => {
    const touchedDown = { ...GROUNDED, secondsLanded: 0.1, landingBeat: 0.3 };
    expect(motionFor(grounded, 0, WALK_SPEED, touchedDown)).toBe("land");
    expect(motionFor(grounded, 0, WALK_SPEED, { ...touchedDown, secondsLanded: 0.4 })).toBe("jog");
  });

  it("stands, walks, jogs and sprints as ground speed rises", () => {
    expect(motionFor(grounded, 0, 0, GROUNDED)).toBe("idle");
    expect(motionFor(grounded, 0, 1.2, GROUNDED)).toBe("walk");
    expect(motionFor(grounded, 0, WALK_SPEED, GROUNDED)).toBe("jog");
    expect(motionFor(grounded, 0, RUN_SPEED, GROUNDED)).toBe("sprint");
  });
});

describe("trackAirBeat", () => {
  const grounded = startingPlayer();

  it("starts a landing beat on touchdown, sized by the fall", () => {
    const falling = trackAirBeat(GROUNDED, { ...grounded, y: 0.2, verticalSpeed: -16 }, FRAME);
    const landed = trackAirBeat(falling, grounded, FRAME);
    expect(landed.secondsLanded).toBe(0);
    expect(landed.landingBeat).toBe(landingBeatFor(16));
  });

  it("gives a long drop a longer landing beat than a jump and a tiny hop none", () => {
    expect(landingBeatFor(16)).toBeGreaterThan(landingBeatFor(6.5));
    expect(landingBeatFor(6.5)).toBeGreaterThan(0);
    expect(landingBeatFor(1)).toBe(0);
  });

  it("does not count a flying descent as a fall", () => {
    const riding = trackAirBeat(GROUNDED, { ...grounded, y: 0.2, verticalSpeed: -7, flying: true }, FRAME);
    expect(trackAirBeat(riding, grounded, FRAME).landingBeat).toBe(0);
  });
});
