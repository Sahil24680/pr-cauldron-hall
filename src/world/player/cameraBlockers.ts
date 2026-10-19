import { type RefObject, useEffect } from "react";
import * as THREE from "three";

type Blocker = { box: THREE.Box3; measuredAt: THREE.Matrix4 | null };

const blockers = new Map<THREE.Object3D, Blocker>();
let boxes: THREE.Box3[] = [];

export function trackBlocker(object: THREE.Object3D) {
  const blocker: Blocker = { box: new THREE.Box3(), measuredAt: null };
  blockers.set(object, blocker);
  boxes = [...blockers.values()].map(({ box }) => box);
  return () => {
    blockers.delete(object);
    boxes = [...blockers.values()].map(({ box }) => box);
  };
}

// Props hanging in mid-air (crests, chandeliers) register here so the third-person camera stops short of them.
export function useCameraBlocker(ref: RefObject<THREE.Object3D | null>) {
  useEffect(() => {
    const blocker = ref.current;
    if (!blocker) {
      return;
    }
    return trackBlocker(blocker);
  }, [ref]);
}

// Measuring a prop walks its whole tree, so a box is only remeasured once its prop has moved.
export function blockerBoxes() {
  for (const [object, blocker] of blockers) {
    if (blocker.measuredAt?.equals(object.matrixWorld)) {
      continue;
    }
    blocker.box.setFromObject(object);
    blocker.measuredAt = (blocker.measuredAt ?? new THREE.Matrix4()).copy(object.matrixWorld);
  }
  return boxes;
}
