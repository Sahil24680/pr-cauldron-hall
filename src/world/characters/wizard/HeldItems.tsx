import type { RefObject } from "react";
import * as THREE from "three";
import { KNUCKLE_Y } from "./Hand";
import { FLAT, lathe } from "./geometry";
import type { WandStyle, WizardLook } from "./look";

// Each wand is one turned profile, (radius, height) from the pommel at the top to the tip at -length, plus its own
// details, so the four read apart by silhouette alone.
const WAND_LENGTH: Record<WandStyle, number> = { elder: 0.5, holly: 0.44, ebony: 0.46, vine: 0.42 };
const GRIP_TOP = 0.08;

function tapered(length: number, butt: number, tip: number, bump: (along: number) => number): [number, number][] {
  const steps = 48;
  return Array.from({ length: steps + 1 }, (_, step) => {
    const along = step / steps;
    const point: [number, number] = [Math.max(0.002, THREE.MathUtils.lerp(butt, tip, along) + bump(along)), -along * length];
    return point;
  });
}

const WAND_PROFILES: Record<WandStyle, [number, number][]> = {
  // Knobbly elder: bead-like nodes all the way down and a rounded knot for a pommel.
  elder: [
    [0.001, GRIP_TOP],
    [0.026, GRIP_TOP - 0.02],
    [0.022, GRIP_TOP - 0.05],
    ...tapered(WAND_LENGTH.elder, 0.019, 0.006, (along) => 0.006 * Math.max(0, Math.sin(along * Math.PI * 9)) * (1 - along * 0.5)),
  ],
  // Holly: a smooth straight taper below a grip carved with three rings and a flared pommel.
  holly: [
    [0.001, GRIP_TOP + 0.012],
    [0.028, GRIP_TOP],
    [0.02, GRIP_TOP - 0.02],
    ...tapered(WAND_LENGTH.holly, 0.021, 0.006, (along) => (along < 0.3 ? 0.004 * Math.max(0, Math.sin(along * Math.PI * 10)) : 0)),
  ],
  // Ebony: plain and sleek, the detail is in its facets and silver fittings.
  ebony: [[0.001, GRIP_TOP], [0.02, GRIP_TOP - 0.01], ...tapered(WAND_LENGTH.ebony, 0.019, 0.005, () => 0)],
  // Vine: a thick handle swelling under the hand, the carved vine wraps it separately.
  vine: [
    [0.001, GRIP_TOP - 0.01],
    [0.022, GRIP_TOP - 0.02],
    ...tapered(WAND_LENGTH.vine, 0.024, 0.006, (along) => (along < 0.25 ? 0.005 * Math.sin((along / 0.25) * Math.PI) : 0)),
  ],
};
// Ebony's six flat faces catch the light like cut stone; the others are turned round.
const WAND_SIDES: Record<WandStyle, number> = { elder: 10, holly: 14, ebony: 6, vine: 12 };
const wandBodies: Record<WandStyle, THREE.BufferGeometry> = {
  elder: lathe(WAND_PROFILES.elder, WAND_SIDES.elder),
  holly: lathe(WAND_PROFILES.holly, WAND_SIDES.holly),
  ebony: lathe(WAND_PROFILES.ebony, WAND_SIDES.ebony),
  vine: lathe(WAND_PROFILES.vine, WAND_SIDES.vine),
};
const wandTipGeometry = new THREE.SphereGeometry(0.014, 10, 6);
const ebonyBand = new THREE.TorusGeometry(0.021, 0.004, 6, 6);
const ebonyCap = new THREE.ConeGeometry(0.008, 0.05, 6).rotateX(Math.PI);
const vineCoil = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3(
    Array.from({ length: 40 }, (_, step) => {
      const along = step / 39;
      const angle = along * Math.PI * 7;
      const radius = THREE.MathUtils.lerp(0.026, 0.009, along);
      return new THREE.Vector3(Math.cos(angle) * radius, GRIP_TOP - 0.03 - along * WAND_LENGTH.vine * 0.8, Math.sin(angle) * radius);
    }),
  ),
  80,
  0.0035,
  5,
  false,
);
const vineLeaf = new THREE.SphereGeometry(0.009, 6, 4).scale(1, 0.4, 1.8);

// A staff is held in the free hand; with the arm hanging it reaches from the floor to about head height.
const STAFF_ABOVE_HAND = 0.92;
const STAFF_BELOW_HAND = 0.95;
const staffShaft = new THREE.CylinderGeometry(0.016, 0.02, STAFF_ABOVE_HAND + STAFF_BELOW_HAND, 10);
const staffCrystal = new THREE.OctahedronGeometry(0.05, 0);
const staffProng = new THREE.ConeGeometry(0.012, 0.13, 6);
const staffOrb = new THREE.SphereGeometry(0.06, 20, 14);
const orbCage = new THREE.TorusGeometry(0.068, 0.006, 6, 24);

export function Wand({ look, tipRef }: { look: WizardLook; tipRef: RefObject<THREE.Mesh | null> }) {
  const style = look.wand;
  return (
    <group position={[0, KNUCKLE_Y + 0.01, 0.005]}>
      <mesh geometry={wandBodies[style]} material={look.wandWood} />
      <mesh ref={tipRef} geometry={wandTipGeometry} material={look.wandTip} position={[0, -WAND_LENGTH[style], 0]} />
      {style === "ebony" && (
        <>
          {[GRIP_TOP - 0.012, -0.06, -0.14].map((y) => (
            <mesh key={y} geometry={ebonyBand} material={look.wandAccent} rotation={FLAT} position={[0, y, 0]} />
          ))}
          <mesh geometry={ebonyCap} material={look.wandAccent} position={[0, -WAND_LENGTH.ebony + 0.02, 0]} />
        </>
      )}
      {style === "vine" && (
        <>
          <mesh geometry={vineCoil} material={look.wandAccent} />
          {[-0.05, -0.13, -0.22].map((y, index) => (
            <mesh
              key={y}
              geometry={vineLeaf}
              material={look.wandAccent}
              position={[index % 2 === 0 ? 0.02 : -0.018, y, 0.006]}
              rotation={[0, index * 1.7, 0.6]}
            />
          ))}
        </>
      )}
    </group>
  );
}

export function Staff({ look }: { look: WizardLook }) {
  return (
    <group position={[0, KNUCKLE_Y + 0.02, 0.005]}>
      <mesh geometry={staffShaft} material={look.wandWood} position={[0, (STAFF_ABOVE_HAND - STAFF_BELOW_HAND) / 2, 0]} />
      <group position={[0, STAFF_ABOVE_HAND, 0]}>
        {look.staff === "orb" ? (
          <>
            <mesh geometry={staffOrb} material={look.staffGem} position={[0, 0.07, 0]} />
            <mesh geometry={orbCage} material={look.gold} position={[0, 0.07, 0]} />
            <mesh geometry={orbCage} material={look.gold} position={[0, 0.07, 0]} rotation={[0, Math.PI / 2, 0]} />
          </>
        ) : (
          <>
            <mesh geometry={staffCrystal} material={look.staffGem} position={[0, 0.1, 0]} scale={[1, 2.2, 1]} />
            {[0, 1, 2].map((prong) => (
              <mesh
                key={prong}
                geometry={staffProng}
                material={look.wandWood}
                position={[Math.cos((prong * Math.PI * 2) / 3) * 0.04, 0.05, Math.sin((prong * Math.PI * 2) / 3) * 0.04]}
                rotation={[Math.sin((prong * Math.PI * 2) / 3) * 0.35, 0, -Math.cos((prong * Math.PI * 2) / 3) * 0.35]}
              />
            ))}
          </>
        )}
      </group>
    </group>
  );
}
