import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useRef } from "react";
import * as THREE from "three";
import { useCastMember } from "../../cast/castStore";
import { PLAYER_PALETTE, useCastLook } from "../characters/human";
import { Wand } from "../characters/wizard/HeldItems";
import { headBob } from "./camera";
import type { Player } from "./player";
import { getPlayerSettings } from "./settings";

// The held wand in the camera's frame (+X right, +Y up, -Z ahead): it rises from the bottom right so its tip ends just
// right of the crosshair. Shrunk toward the eye, it looks the same size but stays nearer than any wall the player reaches.
const VIEW_MODEL_SCALE = 0.4;
const GRIP = new THREE.Vector3(0.32, -0.3, -0.5);
const WAND_DIRECTION = new THREE.Vector3(-0.3, 0.6, -0.74).normalize();
const WAND_DOWN = new THREE.Vector3(0, -1, 0);
const HELD = new THREE.Quaternion().setFromUnitVectors(WAND_DOWN, WAND_DIRECTION);
const HAND_BOB_GAIN = 1.5;

// Minecraft's first-person hand: the player's own wand, carried with the camera.
export function FirstPersonWand({ player }: { player: RefObject<Player> }) {
  const camera = useThree((state) => state.camera);
  const frame = useRef<THREE.Group>(null);
  const grip = useRef<THREE.Group>(null);
  const look = useCastLook(useCastMember("player"), PLAYER_PALETTE, false);
  const tip = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!frame.current || !grip.current) {
      return;
    }
    frame.current.position.copy(camera.position);
    frame.current.quaternion.copy(camera.quaternion);
    const bob = headBob(player.current, getPlayerSettings().headBob);
    grip.current.position.copy(GRIP);
    grip.current.position.x += bob.sway * HAND_BOB_GAIN;
    grip.current.position.y -= bob.lift * HAND_BOB_GAIN;
  });

  return (
    <group ref={frame} scale={VIEW_MODEL_SCALE}>
      <group ref={grip} quaternion={HELD}>
        <Wand look={look} tipRef={tip} />
      </group>
    </group>
  );
}
