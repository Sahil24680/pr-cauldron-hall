import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

type Props = { iron: THREE.Material; brass: THREE.Material };
type Wrap = { y: number; radius: number; tilt: number };

// Two wraps hug the pot's taper: it widens from 0.44 at the base to 0.58 at the rim.
const WRAPS: Wrap[] = [
  { y: 0.36, radius: 0.55, tilt: 0.1 },
  { y: 0.66, radius: 0.63, tilt: -0.08 },
];
const LINK_PITCH = 0.15;
const LOCK_FRONT = 0.68;
const LOCK_Y = 0.5;
const RATTLE_SPEED = 9;
const RATTLE_SWING = 0.16;
const RATTLE_EVERY_SECONDS = 2.6;
const RATTLE_SECONDS = 0.7;

const linkGeometry = new THREE.TorusGeometry(0.06, 0.02, 6, 12);
const lockBody = new THREE.BoxGeometry(0.24, 0.2, 0.09);
const shackle = new THREE.TorusGeometry(0.08, 0.022, 6, 12, Math.PI);
const keyhole = new THREE.CylinderGeometry(0.022, 0.022, 0.1, 8);

function linksAround(wrap: Wrap) {
  const count = Math.round((Math.PI * 2 * wrap.radius) / LINK_PITCH);
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const position: [number, number, number] = [Math.cos(angle) * wrap.radius, 0, Math.sin(angle) * wrap.radius];
    const rotation = new THREE.Euler(index % 2 === 0 ? 0 : Math.PI / 2, -(angle + Math.PI / 2), 0, "YXZ");
    return { key: index, position, rotation };
  });
}

const WRAP_LINKS = WRAPS.map((wrap) => ({ wrap, links: linksAround(wrap) }));

export function Chains({ iron, brass }: Props) {
  const padlock = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const sinceRattle = t % RATTLE_EVERY_SECONDS;
    const fade = Math.max(0, 1 - sinceRattle / RATTLE_SECONDS);
    if (padlock.current) {
      padlock.current.rotation.z = Math.sin(t * RATTLE_SPEED) * RATTLE_SWING * fade;
    }
  });

  return (
    <group>
      {WRAP_LINKS.map(({ wrap, links }) => (
        <group key={wrap.y} position={[0, wrap.y, 0]} rotation={[wrap.tilt, 0, 0]}>
          {links.map((link) => (
            <mesh key={link.key} geometry={linkGeometry} material={iron} position={link.position} rotation={link.rotation} scale={[1.45, 1, 1]} />
          ))}
        </group>
      ))}
      <group position={[0, LOCK_Y + 0.12, LOCK_FRONT]}>
        <group ref={padlock}>
          <mesh geometry={shackle} material={iron} position={[0, -0.04, 0]} />
          <mesh geometry={lockBody} material={brass} position={[0, -0.16, 0]} />
          <mesh geometry={keyhole} material={iron} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.17, 0.01]} scale={[1, 1, 0.5]} />
        </group>
      </group>
    </group>
  );
}
