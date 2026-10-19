import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { type PointerEvent, type RefObject, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CastKey } from "../../../../shared/cast";
import { useCastMember } from "../../../cast/castStore";
import { HumanWizard } from "./HumanWizard";
import { WizardCape } from "./WizardCape";
import { HUMAN_SCALE } from "./assets";
import { useCastLook } from "./castLook";
import { paletteFor } from "./palettes";

// A magic mirror: one cast member, live from the cast store, facing the viewer. Dragging turns them to show the back,
// and letting go turns them to face front again.
const CAMERA = { position: [0, 1.55, 4.4] as const, fov: 32 };
const TARGET: [number, number, number] = [0, 1.15 * HUMAN_SCALE, 0];
const TURN_PER_PIXEL = 0.012;
const RETURN_RATE = 6;

type Turn = { yaw: number; dragging: boolean; lastX: number };

function Subject({ castKey, turn }: { castKey: CastKey; turn: RefObject<Turn> }) {
  const appearance = useCastMember(castKey);
  const palette = useMemo(() => paletteFor(castKey), [castKey]);
  const look = useCastLook(appearance, palette, false);
  const capeAnchor = useRef<THREE.Group>(null);
  const turntable = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!turn.current.dragging) {
      turn.current.yaw = THREE.MathUtils.damp(turn.current.yaw, 0, RETURN_RATE, delta);
    }
    turntable.current?.rotation.set(0, turn.current.yaw, 0);
  });
  return (
    <>
      <group ref={turntable}>
        <HumanWizard look={look} appearance={appearance} motion="idle" capeAnchor={capeAnchor} />
      </group>
      <WizardCape anchor={capeAnchor} look={look} appearance={appearance} />
    </>
  );
}

export function CharacterPreview({ castKey }: { castKey: CastKey }) {
  const turn = useRef<Turn>({ yaw: 0, dragging: false, lastX: 0 });
  const grab = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    turn.current.dragging = true;
    turn.current.lastX = event.clientX;
  };
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (!turn.current.dragging) {
      return;
    }
    turn.current.yaw += (event.clientX - turn.current.lastX) * TURN_PER_PIXEL;
    turn.current.lastX = event.clientX;
  };
  const release = () => {
    turn.current.dragging = false;
  };
  return (
    <div
      title="Drag to turn"
      style={{ width: "100%", height: "100%", cursor: "grab", touchAction: "none" }}
      onPointerDown={grab}
      onPointerMove={drag}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <Canvas camera={{ position: [...CAMERA.position], fov: CAMERA.fov }} dpr={[1, 2]} gl={{ alpha: true }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[2.5, 4, 3]} intensity={1.8} />
        <directionalLight position={[-3, 2, -2]} intensity={0.6} color="#9fb4ff" />
        <Subject key={castKey} castKey={castKey} turn={turn} />
        <OrbitControls target={TARGET} enablePan={false} enableZoom={false} enableRotate={false} />
      </Canvas>
    </div>
  );
}
