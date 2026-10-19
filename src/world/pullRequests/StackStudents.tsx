import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Stage } from "../../../shared/board";
import type { Appearance } from "../../../shared/cast";
import { useCastMember } from "../../cast/castStore";
import { type HumanMotion, HumanWizard, WizardCape, stagePalette, useCastLook } from "../characters/human";
import type { WizardLook } from "../characters/wizard/look";
import { type BookRun, CAULDRON_RADIUS, GRAND_CAULDRON_RADIUS, type Point, type Post } from "../layout";
import { BOOK_CARRY_SPEED, carrierAt } from "./bookRun";

type Props = { stage: Stage; brewers: Post[]; bookRun: BookRun; cauldron: Point };
type StudentProps = { look: WizardLook; appearance: Appearance };

// The book floats just ahead of the carrier's chest, held up by a charm rather than by the walk cycle's swinging hands.
const BOOK_HOLD = { y: 1.05, ahead: 0.38, bob: 0.03 };

const box = new THREE.BoxGeometry(1, 1, 1);

// Brew surface height of the grand cauldron, which is the normal one scaled up.
const GRAND_BREW_Y = 0.62 * (GRAND_CAULDRON_RADIUS / CAULDRON_RADIUS);

function Brewer({ look, appearance, post, cauldron }: StudentProps & { post: Post; cauldron: Point }) {
  const capeAnchor = useRef<THREE.Group>(null);
  const pot = useMemo(() => new THREE.Vector3(0, GRAND_BREW_Y, Math.hypot(cauldron.x - post.spot.x, cauldron.z - post.spot.z)), [cauldron, post]);
  return (
    <>
      <WizardCape anchor={capeAnchor} look={look} appearance={appearance} />
      <group position={[post.spot.x, 0, post.spot.z]} rotation={[0, post.facing, 0]}>
        <HumanWizard look={look} appearance={appearance} motion="stir" pot={pot} capeAnchor={capeAnchor} />
      </group>
    </>
  );
}

function BookCarrier({ look, appearance, run, book }: StudentProps & { run: BookRun; book: Record<"cover" | "pages", THREE.Material> }) {
  const capeAnchor = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const held = useRef<THREE.Group>(null);
  const [motion, setMotion] = useState<HumanMotion>("walk");
  const currentMotion = useRef(motion);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pose = carrierAt(run, t);
    root.current?.position.set(pose.at.x, 0, pose.at.z);
    root.current?.rotation.set(0, pose.facing, 0);
    if (held.current) {
      held.current.visible = pose.carrying;
      held.current.position.y = BOOK_HOLD.y + Math.sin(t * 3) * BOOK_HOLD.bob;
    }
    if (pose.motion !== currentMotion.current) {
      currentMotion.current = pose.motion;
      setMotion(pose.motion);
    }
  });

  return (
    <>
      <WizardCape anchor={capeAnchor} look={look} appearance={appearance} />
      <group ref={root}>
        <HumanWizard look={look} appearance={appearance} motion={motion} pace={BOOK_CARRY_SPEED} capeAnchor={capeAnchor} />
        <group ref={held} position={[0, BOOK_HOLD.y, BOOK_HOLD.ahead]}>
          <mesh geometry={box} material={book.cover} scale={[0.3, 0.07, 0.22]} />
          <mesh geometry={box} material={book.pages} scale={[0.28, 0.05, 0.2]} position={[0, 0.005, 0.005]} />
          <mesh geometry={box} material={book.cover} scale={[0.26, 0.06, 0.2]} position={[0.02, 0.07, 0]} rotation={[0, 0.3, 0]} />
        </group>
      </group>
    </>
  );
}

// Generic helpers for a crowded stage: they share the stage's cast member and one look, and stand for no PR in particular.
export function StackStudents({ stage, brewers, bookRun, cauldron }: Props) {
  const appearance = useCastMember(stage);
  const palette = useMemo(() => stagePalette(stage), [stage]);
  const look = useCastLook(appearance, palette, true);
  const book = useMemo(
    () => ({
      cover: new THREE.MeshStandardMaterial({ color: "#6b1f24", roughness: 0.6, transparent: true }),
      pages: new THREE.MeshStandardMaterial({ color: "#efe1bf", roughness: 0.9, transparent: true }),
    }),
    [],
  );

  return (
    <>
      {brewers.map((post) => (
        <Brewer key={`${post.spot.x}-${post.spot.z}`} look={look} appearance={appearance} post={post} cauldron={cauldron} />
      ))}
      <BookCarrier look={look} appearance={appearance} run={bookRun} book={book} />
    </>
  );
}
