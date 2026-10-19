import { type RefObject, useEffect } from "react";
import type * as THREE from "three";
import type { Stage } from "../../../shared/board";
import { STAGE_ORDER } from "../../lib/theme";

export type Target = { kind: "pr"; number: number } | { kind: "stack"; stage: Stage };

export const pullRequestTargets = new Set<THREE.Object3D>();

// The player controller hands aims around as plain numbers. PR numbers are positive, so a stack takes the negative of its stage's place.
export function targetId(target: Target) {
  return target.kind === "pr" ? target.number : -(STAGE_ORDER.indexOf(target.stage) + 1);
}

export function targetOf(id: number): Target | null {
  if (id > 0) {
    return { kind: "pr", number: id };
  }
  const stage = STAGE_ORDER[-id - 1];
  return stage ? { kind: "stack", stage } : null;
}

export function useAimTarget(ref: RefObject<THREE.Object3D | null>, id: number | null) {
  useEffect(() => {
    const object = ref.current;
    if (!object || id === null) {
      return;
    }
    object.userData.targetId = id;
    pullRequestTargets.add(object);
    return () => {
      pullRequestTargets.delete(object);
    };
  }, [ref, id]);
}

export function usePullRequestTarget(ref: RefObject<THREE.Object3D | null>, number: number | null) {
  useAimTarget(ref, number);
}

export function findTargetId(object: THREE.Object3D | null): number | null {
  for (let current = object; current; current = current.parent) {
    const id: unknown = current.userData.targetId;
    if (typeof id === "number") {
      return id;
    }
  }
  return null;
}
