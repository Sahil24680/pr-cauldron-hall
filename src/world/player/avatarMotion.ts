import * as THREE from "three";
import type { HumanMotion } from "../characters/human";
import type { Player } from "./player";

export type AirBeat = { secondsInAir: number; secondsLanded: number; landingBeat: number; fallSpeed: number };

const STANDING_STILL = 0.05;
const FLYING = 0.5;
// Hall m/s where one stride clip hands over to the next, about midway between their natural paces (walk 1.05, jog
// 3.85, sprint 5.9), so each plays near its own speed. The player's 3.6 m/s cruise is a jog.
const GAIT_CHANGE = { walkToJog: 1.8, jogToSprint: 4.8 };
const TAKEOFF_SECONDS = 0.2;
// A jump lands at about 6.5 m/s and a drop from the rafters at about 16 m/s.
const LANDING = { softSpeed: 4, hardSpeed: 16, shortest: 0.25, longest: 0.6 };

export const GROUNDED: AirBeat = { secondsInAir: 0, secondsLanded: Number.POSITIVE_INFINITY, landingBeat: 0, fallSpeed: 0 };

export function landingBeatFor(fallSpeed: number) {
  if (fallSpeed < LANDING.softSpeed) {
    return 0;
  }
  const hardness = THREE.MathUtils.clamp((fallSpeed - LANDING.softSpeed) / (LANDING.hardSpeed - LANDING.softSpeed), 0, 1);
  return THREE.MathUtils.lerp(LANDING.shortest, LANDING.longest, hardness);
}

export function trackAirBeat(beat: AirBeat, you: Player, delta: number): AirBeat {
  if (you.y > 0) {
    return { secondsInAir: beat.secondsInAir + delta, secondsLanded: 0, landingBeat: 0, fallSpeed: you.flying ? 0 : Math.max(0, -you.verticalSpeed) };
  }
  if (beat.secondsInAir > 0) {
    return { secondsInAir: 0, secondsLanded: 0, landingBeat: landingBeatFor(beat.fallSpeed), fallSpeed: 0 };
  }
  return { ...beat, secondsLanded: beat.secondsLanded + delta };
}

export function motionFor(you: Player, flyBlend: number, groundSpeed: number, beat: AirBeat): HumanMotion {
  if (flyBlend > FLYING) {
    return "levitate";
  }
  if (you.y > 0) {
    return beat.secondsInAir < TAKEOFF_SECONDS ? "jump" : "airborne";
  }
  if (beat.secondsLanded < beat.landingBeat) {
    return "land";
  }
  if (groundSpeed < STANDING_STILL) {
    return "idle";
  }
  if (groundSpeed <= GAIT_CHANGE.walkToJog) {
    return "walk";
  }
  return groundSpeed > GAIT_CHANGE.jogToSprint ? "sprint" : "jog";
}
