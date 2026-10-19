import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useRef, useState } from "react";
import * as THREE from "three";
import { useCastMember } from "../../cast/castStore";
import { type HumanMotion, HumanWizard, PLAYER_PALETTE, WizardCape, useCastLook } from "../characters/human";
import { HIP_Y } from "../characters/wizard/proportions";
import { GROUNDED, motionFor, trackAirBeat } from "./avatarMotion";
import { PIVOT_HEIGHT } from "./orbit";
import type { Player } from "./player";

const FLY_BLEND_RATE = 4;
const BANK_PER_TURN_RATE = 0.22;
const MAX_BANK = 0.55;
const MAX_FLIGHT_PITCH = 0.35;
const HOVER_HEIGHT = 0.45;
// Moving backward faster than this plays the stride in reverse rather than moonwalking.
const BACKING_UP = 0.1;
// Closer than this the wizard would fill the view from inside its own hat, so it is not drawn.
const HIDE_WITHIN = 0.55;

const head = new THREE.Vector3();

function turnRate(previous: number, next: number, delta: number) {
  return Math.atan2(Math.sin(next - previous), Math.cos(next - previous)) / Math.max(delta, 0.001);
}

export function Avatar({ player }: { player: RefObject<Player> }) {
  const camera = useThree((state) => state.camera);
  const figure = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const capeAnchor = useRef<THREE.Group>(null);
  const flight = useRef({ flyBlend: 0, bank: 0, pitch: 0, lastYaw: 0 });
  const airBeat = useRef(GROUNDED);
  const appearance = useCastMember("player");
  const look = useCastLook(appearance, PLAYER_PALETTE, false);
  const [motion, setMotion] = useState<HumanMotion>("idle");
  const currentMotion = useRef(motion);
  const [pace, setPace] = useState(0);

  useFrame((state, rawDelta) => {
    const you = player.current;
    const m = flight.current;
    const delta = Math.min(rawDelta, 0.1);
    const t = state.clock.elapsedTime;
    const sinYaw = Math.sin(you.facing);
    const cosYaw = Math.cos(you.facing);
    const groundSpeed = Math.hypot(you.velocityX, you.velocityZ);
    const forwardSpeed = you.velocityX * sinYaw + you.velocityZ * cosYaw;
    const ease = (rate: number) => Math.min(1, delta * rate);

    m.flyBlend += ((you.flying ? 1 : 0) - m.flyBlend) * ease(FLY_BLEND_RATE);
    const yawRate = turnRate(m.lastYaw, you.facing, delta);
    m.lastYaw = you.facing;
    m.bank += (THREE.MathUtils.clamp(yawRate * BANK_PER_TURN_RATE * Math.min(1, groundSpeed / 2), -MAX_BANK, MAX_BANK) * m.flyBlend - m.bank) * ease(3);
    const flightPitch = THREE.MathUtils.clamp(forwardSpeed * 0.04 - you.verticalSpeed * 0.07, -MAX_FLIGHT_PITCH, MAX_FLIGHT_PITCH);
    m.pitch += (flightPitch * m.flyBlend - m.pitch) * ease(4);

    const hover = (HOVER_HEIGHT + Math.sin(t * 2.1) * 0.07) * m.flyBlend;
    root.current?.position.set(you.x, you.y + hover, you.z);
    root.current?.rotation.set(0, you.facing, 0);
    if (figure.current) {
      figure.current.visible = camera.position.distanceTo(head.set(you.x, you.y + hover + PIVOT_HEIGHT, you.z)) > HIDE_WITHIN;
    }
    tilt.current?.rotation.set(m.pitch, 0, m.bank);

    airBeat.current = trackAirBeat(airBeat.current, you, delta);
    const nextMotion = motionFor(you, m.flyBlend, groundSpeed, airBeat.current);
    if (nextMotion !== currentMotion.current) {
      currentMotion.current = nextMotion;
      setMotion(nextMotion);
    }
    const signedPace = forwardSpeed < -BACKING_UP ? -groundSpeed : groundSpeed;
    if (Math.abs(signedPace - pace) > 0.25) {
      setPace(signedPace);
    }
  });

  return (
    <group ref={figure}>
      <WizardCape anchor={capeAnchor} look={look} appearance={appearance} />
      <group ref={root}>
        <group ref={tilt} position={[0, HIP_Y, 0]}>
          <group position={[0, -HIP_Y, 0]}>
            <HumanWizard look={look} appearance={appearance} motion={motion} pace={pace} capeAnchor={capeAnchor} />
          </group>
        </group>
      </group>
    </group>
  );
}
