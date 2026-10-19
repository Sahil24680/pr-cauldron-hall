import * as THREE from "three";
import { type Arm, reachArm } from "./armReach";

// Brewing, in hall metres relative to the wizard: the body stands at ease while the wand hand circles slowly above
// the pot, its wand pointed down into the brew.
const STIR = { rate: 1.6, radius: 0.08, abovePot: 0.55, beforePot: 0.45, toLeft: 0.12 };
const ELBOW_POLE = new THREE.Vector3(0.8, 0.4, -0.3);

const scratch = { goal: new THREE.Vector3(), pole: new THREE.Vector3() };

// `frame` is the wizard's own unscaled frame; `pot` is the brew's centre in it.
export function stirPot(arm: Arm, frame: THREE.Object3D, pot: THREE.Vector3, time: number) {
  const angle = time * STIR.rate;
  scratch.goal.set(pot.x + STIR.toLeft + Math.cos(angle) * STIR.radius, pot.y + STIR.abovePot, pot.z - STIR.beforePot + Math.sin(angle) * STIR.radius);
  frame.localToWorld(scratch.goal);
  frame.localToWorld(scratch.pole.copy(ELBOW_POLE));
  reachArm(arm, scratch.goal, scratch.pole);
}

// Elbows bend out and down from the body when both hands grip something in front.
const GRIP_POLES = { left: new THREE.Vector3(0.7, -0.4, -0.3), right: new THREE.Vector3(-0.7, -0.4, -0.3) };
const gripScratch = { goal: new THREE.Vector3(), pole: new THREE.Vector3() };

export function gripWith(arms: { left: Arm; right: Arm }, frame: THREE.Object3D, hold: { left: THREE.Vector3; right: THREE.Vector3 }) {
  for (const side of ["left", "right"] as const) {
    frame.localToWorld(gripScratch.goal.copy(hold[side]));
    frame.localToWorld(gripScratch.pole.copy(GRIP_POLES[side]));
    reachArm(arms[side], gripScratch.goal, gripScratch.pole);
  }
}
