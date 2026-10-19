import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import type { PullRequest } from "../../../shared/board";
import type { Point } from "../layout";
import { CauldronPot } from "./CauldronPot";
import type { Departure } from "./PullRequestWizard";
import { brewOf } from "./brew";
import { usePullRequestTarget } from "./targets";

type Props = { pr: PullRequest; at: Point; now: number; departure: Departure | null; aimed: boolean; onSelect: (number: number) => void };

const MOVE_SHRINK_PER_SECOND = 4;
const ERUPTION_SECONDS = 1.6;

export function Cauldron({ pr, at, now, departure, aimed, onSelect }: Props) {
  const root = useRef<THREE.Group>(null);
  usePullRequestTarget(root, departure ? null : pr.number);
  const erupting = useRef(false);
  const sim = useRef({ shown: { ...at }, scale: 0, departedFor: 0 });

  useFrame((state, rawDelta) => {
    const s = sim.current;
    const delta = Math.min(rawDelta, 0.1);
    const group = root.current;
    if (!group) {
      return;
    }
    const moving = s.shown.x !== at.x || s.shown.z !== at.z;
    if (departure) {
      s.departedFor += delta;
    }
    erupting.current = departure === "merged" && s.departedFor < ERUPTION_SECONDS;
    const leaving = departure !== null && !erupting.current;
    const targetScale = moving || leaving ? 0 : 1;
    s.scale += Math.sign(targetScale - s.scale) * Math.min(Math.abs(targetScale - s.scale), delta * MOVE_SHRINK_PER_SECOND);
    if (moving && s.scale === 0) {
      s.shown = { ...at };
    }
    group.position.set(s.shown.x, 0, s.shown.z);
    group.scale.setScalar(s.scale * (erupting.current ? 1 + Math.sin(state.clock.elapsedTime * 30) * 0.04 : 1));
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!document.pointerLockElement) {
      onSelect(pr.number);
    }
  };

  return (
    <group
      ref={root}
      onClick={handleClick}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.classList.add("wand-hover");
      }}
      onPointerOut={() => document.body.classList.remove("wand-hover")}
    >
      <CauldronPot brew={brewOf(pr, now)} aimed={aimed} surging={erupting} />
    </group>
  );
}
