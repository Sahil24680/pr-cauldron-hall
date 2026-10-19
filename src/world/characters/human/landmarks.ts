import * as THREE from "three";

// Where a body's joints sit in its bind pose (model metres), read from its skeleton so garments and accessories fit
// either build and any physique without per-model numbers.
export type BodyLandmarks = {
  waistY: number;
  hipY: number;
  chestY: number;
  neckBaseY: number;
  shoulderY: number;
  elbowX: number;
  wristX: number;
};

const WAIST_BELOW_SPINE = 0.02;
const HIP_BELOW_PELVIS = 0.03;
const CHEST_BELOW_UPPER_SPINE = 0.08;
const NECK_BASE_BELOW_NECK = 0.05;
const WRIST_BEFORE_HAND = 0.006;

export function measureLandmarks(skeleton: THREE.Skeleton): BodyLandmarks {
  const at = (name: string) => {
    const position = new THREE.Vector3();
    skeleton.getBoneByName(name)?.getWorldPosition(position);
    return position;
  };
  const hand = at("hand_l");
  return {
    waistY: at("spine_01").y - WAIST_BELOW_SPINE,
    hipY: at("pelvis").y - HIP_BELOW_PELVIS,
    chestY: at("spine_03").y - CHEST_BELOW_UPPER_SPINE,
    neckBaseY: at("neck_01").y - NECK_BASE_BELOW_NECK,
    shoulderY: hand.y,
    elbowX: Math.abs(at("lowerarm_l").x),
    wristX: Math.abs(hand.x) - WRIST_BEFORE_HAND,
  };
}
