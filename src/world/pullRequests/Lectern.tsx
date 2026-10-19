import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
export const PAGE_TURN_EVERY_SECONDS = 5;
export const PAGE_TURN_SECONDS = 0.9;
const TOP_Y = 1.08;
const TOP_TILT = 0.38;
const PAGE = { width: 0.25, depth: 0.33 };

const box = new THREE.BoxGeometry(1, 1, 1);
const pageGeometry = new THREE.PlaneGeometry(PAGE.width, PAGE.depth).rotateX(-Math.PI / 2).translate(PAGE.width / 2, 0, 0);

// 0 while the page rests, rising to 1 as it flips over the spine.
export function pageTurnProgress(time: number) {
  const sinceTurn = time % PAGE_TURN_EVERY_SECONDS;
  return sinceTurn < PAGE_TURN_SECONDS ? sinceTurn / PAGE_TURN_SECONDS : 0;
}

// The reading desk faces its reader, who stands on its -Z side.
export function Lectern() {
  const materials = useMemo(
    () => ({
      wood: new THREE.MeshStandardMaterial({ color: "#5a3a22", roughness: 0.7, transparent: true }),
      brass: new THREE.MeshStandardMaterial({ color: "#b8913f", roughness: 0.35, metalness: 0.8, transparent: true }),
      cover: new THREE.MeshStandardMaterial({ color: "#6b1f24", roughness: 0.6, transparent: true }),
      paper: new THREE.MeshStandardMaterial({ color: "#efe1bf", roughness: 0.9, transparent: true, side: THREE.DoubleSide }),
    }),
    [],
  );
  const page = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (page.current) {
      page.current.rotation.z = Math.PI * Math.sin((pageTurnProgress(state.clock.elapsedTime) * Math.PI) / 2);
    }
  });

  return (
    <group>
      <mesh geometry={box} material={materials.wood} scale={[0.56, 0.06, 0.46]} position={[0, 0.03, 0]} />
      <mesh geometry={box} material={materials.wood} scale={[0.13, TOP_Y - 0.06, 0.13]} position={[0, TOP_Y / 2, 0]} />
      <mesh geometry={box} material={materials.brass} scale={[0.17, 0.05, 0.17]} position={[0, TOP_Y * 0.55, 0]} />
      <group position={[0, TOP_Y, 0]} rotation={[TOP_TILT, 0, 0]}>
        <mesh geometry={box} material={materials.wood} scale={[0.66, 0.04, 0.48]} />
        <mesh geometry={box} material={materials.cover} scale={[0.6, 0.02, 0.38]} position={[0, 0.03, 0]} />
        <mesh geometry={box} material={materials.paper} scale={[PAGE.width, 0.035, PAGE.depth]} position={[-PAGE.width / 2 - 0.01, 0.055, 0]} />
        <mesh geometry={box} material={materials.paper} scale={[PAGE.width, 0.035, PAGE.depth]} position={[PAGE.width / 2 + 0.01, 0.055, 0]} />
        <group ref={page} position={[0, 0.074, 0]}>
          <mesh geometry={pageGeometry} material={materials.paper} />
        </group>
      </group>
    </group>
  );
}
