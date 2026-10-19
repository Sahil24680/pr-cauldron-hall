import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { type RefObject, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { PullRequest } from "../../../shared/board";
import { type CiState, findCiState, findStage, isStale } from "../../../shared/stage";
import { useCastMember } from "../../cast/castStore";
import { stripTicketPrefix } from "../../lib/title";
import { type HumanMotion, HumanWizard, STONE_PALETTE, WizardCape, stagePalette, turnedToStone, useCastLook } from "../characters/human";
import { WIZARD_HEIGHT } from "../characters/wizard/proportions";
import { softDot } from "../effects/softDot";
import { SceneLabel } from "../labels/SceneLabel";
import { DOOR, type Station, routeBetween, routeFromDoor } from "../layout";
import { Broom } from "../props/Broom";
import { MAGIC_COLORS } from "./magicColors";
import { usePullRequestTarget } from "./targets";

export type Departure = "merged" | "closed";

type Props = {
  pr: PullRequest;
  station: Station;
  now: number;
  arriving: boolean;
  departure: Departure | null;
  selected: boolean;
  showTag: boolean;
  onSelect: (number: number) => void;
  onHover: (number: number | null) => void;
};

// Seated on the Sitting clip's hips, scaled to the hall.
const BROOM_SEAT_Y = 0.62;
// Hands on the handle ahead of the seat, crouched forward as the wizard flies off.
const BROOM_GRIPS = { left: new THREE.Vector3(0.05, BROOM_SEAT_Y + 0.05, 0.42), right: new THREE.Vector3(-0.04, BROOM_SEAT_Y + 0.06, 0.56) };
const RIDING_LEAN = 0.4;
const WALK_SPEED = 1.1;
const FADE_PER_SECOND = 2.5;
const BROOM_TAKEOFF_SECONDS = 0.5;
const VANISH_SECONDS = 0.8;
const STREAM_PARTICLES = 28;
const BREW_CENTER = new THREE.Vector3(0, 0.62, 1);
const STREAM_SPEED: Record<CiState, number> = { running: 1.4, passing: 0.5, failing: 0.9, none: 0 };

const selectRing = new THREE.TorusGeometry(0.55, 0.045, 6, 28);
const ringRotation = new THREE.Euler(-Math.PI / 2, 0, 0);

function turnToward(from: number, to: number, amount: number) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * amount;
}

type StreamProps = { ci: CiState; brewing: { current: boolean }; tip: RefObject<THREE.Mesh | null>; wizard: RefObject<THREE.Group | null> };

function MagicStream({ ci, brewing, tip, wizard }: StreamProps) {
  const points = useRef<THREE.Points>(null);
  const progress = useMemo(() => Array.from({ length: STREAM_PARTICLES }, (_, index) => index / STREAM_PARTICLES), []);
  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(STREAM_PARTICLES * 3), 3));
    const material = new THREE.PointsMaterial({
      size: 0.16,
      map: softDot(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { geometry, material };
  }, []);
  material.color.set(MAGIC_COLORS[ci]);
  const point = useMemo(() => new THREE.Vector3(), []);
  const wandTip = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const active = brewing.current && ci !== "none";
    if (points.current) {
      points.current.visible = active;
    }
    if (!active) {
      return;
    }
    const tipMesh = tip.current;
    const root = wizard.current;
    if (!tipMesh || !root) {
      return;
    }
    root.worldToLocal(tipMesh.getWorldPosition(wandTip));
    const position = geometry.getAttribute("position");
    const sputter = ci === "failing" ? Math.abs(Math.sin(state.clock.elapsedTime * 7)) : 1;
    progress.forEach((value, index) => {
      const next = (value + delta * STREAM_SPEED[ci] * (0.7 + (index % 5) * 0.12)) % 1;
      progress[index] = next;
      point.lerpVectors(wandTip, BREW_CENTER, next);
      point.y += Math.sin(next * Math.PI) * 0.35;
      point.x += Math.sin(next * 9 + index) * 0.06;
      position.setXYZ(index, point.x, point.y, point.z);
    });
    position.needsUpdate = true;
    material.opacity = 0.9 * sputter;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

// Live wizards stir their cauldron; a stale one has turned to stone mid-spell.
function motionFor(walking: boolean, riding: boolean, stale: boolean): HumanMotion {
  if (riding) {
    return "ride";
  }
  if (walking) {
    return "walk";
  }
  return stale ? "brew" : "stir";
}

export function Wizard({ pr, station, now, arriving, departure, selected, showTag, onSelect, onHover }: Props) {
  const stale = isStale(pr, now);
  const ci = findCiState(pr);
  const stage = findStage(pr);

  const member = useCastMember(stage);
  const appearance = useMemo(() => (stale ? turnedToStone(member) : member), [member, stale]);
  const palette = useMemo(() => (stale ? STONE_PALETTE : stagePalette(stage)), [stage, stale]);
  const look = useCastLook(appearance, palette, true);
  look.staffGem.color.set(MAGIC_COLORS[ci]);
  const extras = useMemo(
    () => ({
      broom: new THREE.MeshStandardMaterial({ color: "#8a5a2b", roughness: 0.8, transparent: true }),
      cord: new THREE.MeshStandardMaterial({ color: "#5a3a20", roughness: 0.9, transparent: true }),
      bristle: new THREE.MeshStandardMaterial({ color: "#d2b06a", roughness: 0.9, transparent: true, side: THREE.DoubleSide }),
      highlight: new THREE.MeshBasicMaterial({ color: "#ffe9a8", transparent: true, toneMapped: false }),
    }),
    [],
  );
  const materials = useMemo(() => [...Object.values(look), ...Object.values(extras)].filter((material) => material instanceof THREE.Material), [look, extras]);

  const root = useRef<THREE.Group>(null);
  usePullRequestTarget(root, departure ? null : pr.number);
  const capeAnchor = useRef<THREE.Group>(null);
  const wandTip = useRef<THREE.Mesh>(null);
  const [motion, setMotion] = useState<HumanMotion>(motionFor(arriving, false, stale));
  const currentMotion = useRef(motion);
  const broom = useRef<THREE.Group>(null);
  const brewingRef = useRef(false);

  const sim = useRef({
    position: arriving ? { ...DOOR } : { ...station.spot },
    lift: 0,
    facing: arriving ? Math.PI : station.facing,
    route: arriving ? routeFromDoor(station) : [],
    station,
    opacity: arriving ? 0 : 1,
    departedFor: 0,
    stride: 0,
  });

  useFrame((_, rawDelta) => {
    const s = sim.current;
    const delta = Math.min(rawDelta, 0.1);
    const group = root.current;
    if (!group) {
      return;
    }

    if (s.station.spot.x !== station.spot.x || s.station.spot.z !== station.spot.z) {
      s.route = routeBetween(s.position, station);
      s.station = station;
    }

    const goal = s.route[0];
    const walking = goal !== undefined && !departure;
    if (walking) {
      const dx = goal.x - s.position.x;
      const dz = goal.z - s.position.z;
      const distance = Math.hypot(dx, dz);
      const step = Math.min(distance, WALK_SPEED * delta);
      if (distance > 0.001) {
        s.position.x += (dx / distance) * step;
        s.position.z += (dz / distance) * step;
        s.facing = turnToward(s.facing, Math.atan2(dx, dz), Math.min(1, delta * 12));
      }
      if (distance < 0.05) {
        s.route.shift();
      }
    } else if (!departure) {
      s.facing = turnToward(s.facing, station.facing, Math.min(1, delta * 8));
    }

    if (departure) {
      s.departedFor += delta;
      if (departure === "merged" && s.departedFor > BROOM_TAKEOFF_SECONDS) {
        const flight = s.departedFor - BROOM_TAKEOFF_SECONDS;
        s.lift += delta * (2 + flight * 3);
        s.position.z -= delta * (1 + flight * 4);
        s.facing += delta * 2.5;
      }
    }
    const scale = departure === "closed" ? Math.max(0, 1 - s.departedFor / VANISH_SECONDS) : 1;
    const brewing = !walking && !departure;
    brewingRef.current = brewing && !stale;

    const targetOpacity = departure === "merged" && s.departedFor > 2.4 ? 0 : 1;
    s.opacity += Math.sign(targetOpacity - s.opacity) * Math.min(Math.abs(targetOpacity - s.opacity), delta * FADE_PER_SECOND);
    for (const material of materials) {
      material.opacity = s.opacity;
    }

    group.position.set(s.position.x, s.lift, s.position.z);
    group.rotation.y = s.facing;
    group.scale.setScalar(scale);

    const riding = departure === "merged";
    const nextMotion = motionFor(walking, riding, stale);
    if (nextMotion !== currentMotion.current) {
      currentMotion.current = nextMotion;
      setMotion(nextMotion);
    }
    if (broom.current) {
      broom.current.visible = riding;
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!document.pointerLockElement) {
      onSelect(pr.number);
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
          onHover(pr.number);
          document.body.classList.add("wand-hover");
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.classList.remove("wand-hover");
        }}
      >
        <group>
          <HumanWizard
            look={look}
            appearance={appearance}
            motion={motion}
            pace={WALK_SPEED}
            stone={stale}
            frozen={stale && motion === "brew"}
            pot={BREW_CENTER}
            hold={motion === "ride" ? BROOM_GRIPS : undefined}
            lean={motion === "ride" ? RIDING_LEAN : 0}
            wandTip={wandTip}
            capeAnchor={capeAnchor}
          />
        </group>

        <MagicStream ci={ci} brewing={brewingRef} tip={wandTip} wizard={root} />

        <group ref={broom} visible={false} position={[0, BROOM_SEAT_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <Broom wood={extras.broom} straw={extras.bristle} cord={extras.cord} />
        </group>

        {selected && <mesh geometry={selectRing} material={extras.highlight} rotation={ringRotation} position={[0, 0.05, 0]} />}

        {showTag && !departure && (
          <SceneLabel position={[0, WIZARD_HEIGHT + 0.3, 0]}>
            <div className={`tag${selected ? " selected" : ""}`}>
              <span className="tag-number">#{pr.number}</span> {stripTicketPrefix(pr.title)}
            </div>
          </SceneLabel>
        )}
      </group>
    </>
  );
}
