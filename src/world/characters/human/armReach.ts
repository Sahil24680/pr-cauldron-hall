import * as THREE from "three";

export type Arm = { upper: THREE.Bone; lower: THREE.Bone; hand: THREE.Bone };

const scratch = {
  shoulder: new THREE.Vector3(),
  elbow: new THREE.Vector3(),
  wrist: new THREE.Vector3(),
  goal: new THREE.Vector3(),
  toGoal: new THREE.Vector3(),
  bend: new THREE.Vector3(),
  elbowGoal: new THREE.Vector3(),
  from: new THREE.Vector3(),
  to: new THREE.Vector3(),
  turn: new THREE.Quaternion(),
  parent: new THREE.Quaternion(),
  world: new THREE.Quaternion(),
};
// Stops short of a locked-straight arm, which reads as stiff and flips the elbow when the goal is just out of reach.
const MAX_REACH_SHARE = 0.98;

// Turns a bone so the direction from `fromPoint` to `toPoint` (world space, both moving with the bone) becomes the
// direction to `goal`.
function aimBone(bone: THREE.Bone, fromPoint: THREE.Vector3, toPoint: THREE.Vector3, goal: THREE.Vector3) {
  scratch.from.subVectors(toPoint, fromPoint).normalize();
  scratch.to.subVectors(goal, fromPoint).normalize();
  scratch.turn.setFromUnitVectors(scratch.from, scratch.to);
  bone.getWorldQuaternion(scratch.world);
  bone.parent?.getWorldQuaternion(scratch.parent);
  bone.quaternion.copy(scratch.parent.invert().multiply(scratch.turn).multiply(scratch.world));
  bone.updateWorldMatrix(false, true);
}

// Two-joint reach: bends the elbow toward `pole` (a world point) so the wrist lands on `goal` (world space).
export function reachArm(arm: Arm, goal: THREE.Vector3, pole: THREE.Vector3) {
  arm.upper.updateWorldMatrix(true, true);
  arm.upper.getWorldPosition(scratch.shoulder);
  arm.lower.getWorldPosition(scratch.elbow);
  arm.hand.getWorldPosition(scratch.wrist);
  const upperLength = scratch.shoulder.distanceTo(scratch.elbow);
  const lowerLength = scratch.elbow.distanceTo(scratch.wrist);

  scratch.toGoal.subVectors(goal, scratch.shoulder);
  const reach = Math.min(scratch.toGoal.length(), (upperLength + lowerLength) * MAX_REACH_SHARE);
  scratch.toGoal.setLength(reach);
  scratch.goal.addVectors(scratch.shoulder, scratch.toGoal);

  // Law of cosines gives how far along the shoulder-goal line the elbow sits and how far it bows out toward the pole.
  const along = (reach * reach + upperLength * upperLength - lowerLength * lowerLength) / (2 * reach);
  const out = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const axis = scratch.toGoal.clone().normalize();
  scratch.bend.subVectors(pole, scratch.shoulder);
  scratch.bend.addScaledVector(axis, -scratch.bend.dot(axis)).normalize();
  scratch.elbowGoal.copy(scratch.shoulder).addScaledVector(axis, along).addScaledVector(scratch.bend, out);

  aimBone(arm.upper, scratch.shoulder, scratch.elbow, scratch.elbowGoal);
  arm.lower.getWorldPosition(scratch.elbow);
  arm.hand.getWorldPosition(scratch.wrist);
  aimBone(arm.lower, scratch.elbow, scratch.wrist, scratch.goal);
}
