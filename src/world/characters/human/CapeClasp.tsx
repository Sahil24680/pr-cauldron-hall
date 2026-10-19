import * as THREE from "three";
import type { WizardLook } from "../wizard/look";

// Two gold bosses joined by a short chain at the collar, fastening the cape's yoke across the chest. Bind-pose model
// metres, carried by the chest follower; `at` is the robe's front surface under the collar.
const CLASP = { spread: 0.055, bossRadius: 0.017, bossDepth: 0.007 };
const boss = new THREE.CylinderGeometry(CLASP.bossRadius, CLASP.bossRadius * 1.1, CLASP.bossDepth, 16).rotateX(Math.PI / 2);
const gem = new THREE.SphereGeometry(CLASP.bossRadius * 0.45, 10, 8);
const chain = new THREE.CylinderGeometry(0.0022, 0.0022, CLASP.spread * 2, 5).rotateZ(Math.PI / 2);

export function CapeClasp({ look, at }: { look: WizardLook; at: { y: number; z: number } }) {
  return (
    <group position={[0, at.y, at.z]}>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * CLASP.spread, 0, 0]}>
          <mesh geometry={boss} material={look.gold} />
          <mesh geometry={gem} material={look.gem} position={[0, 0, CLASP.bossDepth / 2]} />
        </group>
      ))}
      <mesh geometry={chain} material={look.gold} position={[0, -0.012, 0.002]} />
    </group>
  );
}
