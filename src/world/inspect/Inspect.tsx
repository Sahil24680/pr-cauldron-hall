import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type ComponentRef, type RefObject, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { type Appearance, CAST_KEYS } from "../../../shared/cast";
import { useCast } from "../../cast/castStore";
import { type HumanMotion, HumanWizard, MOTION_CLIPS, type Palette, WizardCape, paletteFor, useCastLook } from "../characters/human";

// A model sheet of the cast: each member from the front and from the side, live from the cast store.
const SUBJECTS = CAST_KEYS.map((key) => ({ key, palette: paletteFor(key) }));
const VIEWS = [
  { label: "front", yaw: 0 },
  { label: "side", yaw: Math.PI / 2 },
];
const SPACING = 1.25;
const CLOSE_UP_DISTANCE = 1.1;
const HEAD_HEIGHT = 1.84;
const WAND_HAND_BONE = "hand_l";

// #inspect shows every model; #inspect-2 frames the head of model 2, and #inspect-2-hand its wand hand.
function focusedModel() {
  const match = /^#inspect-(\d+)(-hand)?$/.exec(window.location.hash);
  return match ? { index: Number(match[1]), hand: match[2] !== undefined } : null;
}

function modelName(index: number) {
  return `inspect-model-${index}`;
}

function modelX(index: number) {
  return (index - (SUBJECTS.length * VIEWS.length - 1) / 2) * SPACING;
}

// ?motion=walk (any HumanMotion) plays that clip on every model.
function chosenMotion(): HumanMotion {
  const requested = new URLSearchParams(window.location.search).get("motion");
  return Object.keys(MOTION_CLIPS).find((motion): motion is HumanMotion => motion === requested) ?? "idle";
}

type ModelProps = { name: string; appearance: Appearance; palette: Palette; x: number; yaw: number; motion: HumanMotion };

function Model({ name, appearance, palette, x, yaw, motion }: ModelProps) {
  const look = useCastLook(appearance, palette, false);
  const capeAnchor = useRef<THREE.Group>(null);
  return (
    <>
      <group name={name} position={[x, 0, 0]} rotation={[0, yaw, 0]}>
        <HumanWizard look={look} appearance={appearance} motion={motion} capeAnchor={capeAnchor} />
      </group>
      <WizardCape anchor={capeAnchor} look={look} appearance={appearance} />
    </>
  );
}

function DebugHandle() {
  const state = useThree();
  Object.assign(window, { inspectScene: state.scene, inspectCamera: state.camera, inspectControls: state.controls });
  return null;
}

// Aims the close-up at the wand hand once the model has loaded, from whichever side of the body the hand is on.
type Controls = ComponentRef<typeof OrbitControls>;

function FrameWandHand({ index, controls }: { index: number; controls: RefObject<Controls | null> }) {
  const { scene, camera } = useThree();
  const framed = useRef(false);
  useFrame(() => {
    const model = scene.getObjectByName(modelName(index));
    const hand = model?.getObjectByName(WAND_HAND_BONE);
    const orbit = controls.current;
    if (framed.current || !model || !hand || !orbit) {
      return;
    }
    const at = hand.getWorldPosition(new THREE.Vector3());
    const facing = at.z >= model.position.z ? 1 : -1;
    camera.position.set(at.x, at.y, at.z + facing * CLOSE_UP_DISTANCE);
    orbit.target.copy(at);
    orbit.update();
    framed.current = true;
  });
  return null;
}

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return hash;
}

export function Inspect() {
  const hash = useHash();
  const focus = focusedModel();
  const motion = chosenMotion();
  const cast = useCast();
  const controls = useRef<Controls>(null);
  const models = SUBJECTS.flatMap((subject, row) =>
    VIEWS.map((view, column) => ({
      key: `${subject.key}-${view.label}`,
      name: modelName(row * VIEWS.length + column),
      appearance: cast[subject.key],
      palette: subject.palette,
      yaw: view.yaw,
      x: modelX(row * VIEWS.length + column),
    })),
  );
  return (
    <Canvas
      key={hash}
      camera={{
        position: focus === null ? [0, 1.3, 9.5] : [modelX(focus.index), HEAD_HEIGHT, CLOSE_UP_DISTANCE],
        fov: 40,
      }}
      style={{ position: "fixed", inset: 0, background: "#20242c" }}
    >
      <DebugHandle />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <directionalLight position={[-4, 3, -2]} intensity={0.5} color="#9fb4ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color="#3a3f4a" />
      </mesh>
      {models.map((model) => (
        <Model key={model.key} name={model.name} appearance={model.appearance} palette={model.palette} x={model.x} yaw={model.yaw} motion={motion} />
      ))}
      <OrbitControls ref={controls} makeDefault target={focus === null ? [0, 1.2, 0] : [modelX(focus.index), HEAD_HEIGHT, 0]} />
      {focus?.hand && <FrameWandHand index={focus.index} controls={controls} />}
    </Canvas>
  );
}
