import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { PullRequest, Stage } from "../../../shared/board";
import { useCastMember } from "../../cast/castStore";
import { STAGE_THEMES } from "../../lib/theme";
import { HumanWizard, WizardCape, headmasterPalette, useCastLook } from "../characters/human";
import { WIZARD_HEIGHT } from "../characters/wizard/proportions";
import { SceneLabel } from "../labels/SceneLabel";
import { CAULDRON_RADIUS, GRAND_CAULDRON_RADIUS, type Stack } from "../layout";
import { CauldronPot, DIMMED_OPACITY } from "./CauldronPot";
import { Lectern } from "./Lectern";
import { StackStudents } from "./StackStudents";
import { type Brew, summariseBrew } from "./brew";
import { targetId, useAimTarget } from "./targets";

type Props = { stack: Stack; pullRequests: PullRequest[]; now: number; dimmed: boolean; aimed: boolean; onOpen: (stage: Stage) => void };
type Mood = "failing" | "ready" | "running" | "calm";

const MOOD_COLORS: Record<Mood, string> = { failing: "#ff4b3a", ready: "#ffd166", running: "#b48cff", calm: "#8fd3ff" };
const GRAND_SCALE = GRAND_CAULDRON_RADIUS / CAULDRON_RADIUS;
const CALM = { current: false };
const COUNT_HEIGHT = WIZARD_HEIGHT + 0.55;
const COUNT_BOB = 0.06;
const HALO = { inner: 0.62, outer: 0.78, opacity: 0.35, aimedOpacity: 0.85, pulse: 0.12 };

const flat = new THREE.Euler(-Math.PI / 2, 0, 0);
const haloGeometry = new THREE.RingGeometry(HALO.inner, HALO.outer, 40);

function moodOf(brew: Brew): Mood {
  if (brew.ci === "failing") {
    return "failing";
  }
  if (brew.ready) {
    return "ready";
  }
  return brew.ci === "running" ? "running" : "calm";
}

export function Headmaster({ stack, pullRequests, now, dimmed, aimed, onOpen }: Props) {
  const { stage, station, lectern } = stack;
  const brew = summariseBrew(pullRequests, now);
  const mood = brew ? moodOf(brew) : "calm";

  const appearance = useCastMember("headmaster");
  const palette = useMemo(() => headmasterPalette(stage), [stage]);
  const look = useCastLook(appearance, palette, true);
  look.staffGem.color.set(MOOD_COLORS[mood]);
  const halo = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  halo.color.set(MOOD_COLORS[mood]);
  const bodyMaterials = useMemo(() => Object.values(look).filter((material) => material instanceof THREE.Material), [look]);

  const root = useRef<THREE.Group>(null);
  useAimTarget(root, targetId({ kind: "stack", stage }));
  const count = useRef<THREE.Group>(null);
  const capeAnchor = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const opacity = dimmed ? DIMMED_OPACITY : 1;
    for (const material of bodyMaterials) {
      material.opacity = opacity;
    }
    halo.opacity = (aimed ? HALO.aimedOpacity : HALO.opacity) * opacity + Math.sin(t * 2) * HALO.pulse;

    if (count.current) {
      count.current.position.y = COUNT_HEIGHT + Math.sin(t * 1.4) * COUNT_BOB;
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!document.pointerLockElement) {
      onOpen(stage);
    }
  };

  return (
    <>
      <WizardCape anchor={capeAnchor} look={look} appearance={appearance} />
      <group
        ref={root}
        onClick={handleClick}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.classList.add("wand-hover");
        }}
        onPointerOut={() => document.body.classList.remove("wand-hover")}
      >
        <group position={[station.spot.x, 0, station.spot.z]} rotation={[0, station.facing, 0]}>
          <HumanWizard look={look} appearance={appearance} motion="lecture" capeAnchor={capeAnchor} />
          <mesh geometry={haloGeometry} material={halo} rotation={flat} position={[0, 0.02, 0]} />
          <group ref={count} position={[0, COUNT_HEIGHT, 0]}>
            <SceneLabel>
              <div className={`stack-count mood-${mood}`}>
                <span className="stack-count-number">{pullRequests.length}</span>
                <span className="stack-count-label">{STAGE_THEMES[stage].plain}</span>
              </div>
            </SceneLabel>
          </group>
        </group>
        <StackStudents stage={stage} brewers={stack.brewers} bookRun={stack.bookRun} cauldron={station.cauldron} dimmed={dimmed} />
        <group position={[lectern.x, 0, lectern.z]}>
          <Lectern dimmed={dimmed} />
        </group>
        {brew && (
          <group position={[station.cauldron.x, 0, station.cauldron.z]} scale={GRAND_SCALE}>
            <CauldronPot brew={brew} dimmed={dimmed} aimed={aimed} surging={CALM} />
          </group>
        )}
      </group>
    </>
  );
}
