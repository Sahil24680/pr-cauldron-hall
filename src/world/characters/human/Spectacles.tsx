import * as THREE from "three";
import type { Appearance } from "../../../../shared/cast";
import type { WizardLook } from "../wizard/look";

type Landmarks = { eyeY: number; eyeX: number; eyeFrontZ: number };
type GlassesStyle = Exclude<Appearance["glasses"], "none">;

const LENS_RADIUS = 0.019;
const RIM_THICKNESS = 0.0022;
const LENS_GAP = 0.012;
const ARM_LENGTH = 0.1;
const SQUARE_HALF = LENS_RADIUS * 0.92;
const MONOCLE_CHAIN_DROP = 0.09;

function squarePath() {
  const halfHeight = SQUARE_HALF * 0.8;
  const corners = [
    new THREE.Vector3(-SQUARE_HALF, -halfHeight, 0),
    new THREE.Vector3(SQUARE_HALF, -halfHeight, 0),
    new THREE.Vector3(SQUARE_HALF, halfHeight, 0),
    new THREE.Vector3(-SQUARE_HALF, halfHeight, 0),
  ];
  return new THREE.CatmullRomCurve3(corners, true, "catmullrom", 0.05);
}

const RIMS: Record<GlassesStyle, THREE.BufferGeometry> = {
  round: new THREE.TorusGeometry(LENS_RADIUS, RIM_THICKNESS, 6, 24),
  monocle: new THREE.TorusGeometry(LENS_RADIUS * 1.1, RIM_THICKNESS * 1.2, 6, 24),
  halfMoon: new THREE.TorusGeometry(LENS_RADIUS, RIM_THICKNESS, 6, 16, Math.PI),
  square: new THREE.TubeGeometry(squarePath(), 32, RIM_THICKNESS, 6, true),
};
const GLASS: Record<GlassesStyle, THREE.BufferGeometry> = {
  round: new THREE.CircleGeometry(LENS_RADIUS, 20),
  monocle: new THREE.CircleGeometry(LENS_RADIUS * 1.1, 20),
  halfMoon: new THREE.CircleGeometry(LENS_RADIUS, 16, 0, Math.PI),
  square: new THREE.PlaneGeometry(SQUARE_HALF * 2, SQUARE_HALF * 1.6),
};
// Half-moon lenses are the top half of a circle flipped over, so the flat edge sits at the top and the wearer reads over it.
const HALF_MOON_FLIP = new THREE.Euler(0, 0, Math.PI);
const HALF_MOON_DROP = -0.006;
const bridge = new THREE.CylinderGeometry(RIM_THICKNESS, RIM_THICKNESS, 0.02, 6);
const arm = new THREE.CylinderGeometry(RIM_THICKNESS * 0.8, RIM_THICKNESS * 0.8, ARM_LENGTH, 6);
const chain = new THREE.CylinderGeometry(RIM_THICKNESS * 0.4, RIM_THICKNESS * 0.4, MONOCLE_CHAIN_DROP, 4);
const sideways = new THREE.Euler(0, 0, Math.PI / 2);
const backward = new THREE.Euler(Math.PI / 2, 0, 0);

function Lens({ style, look }: { style: GlassesStyle; look: WizardLook }) {
  const halfMoon = style === "halfMoon";
  return (
    <group position={[0, halfMoon ? HALF_MOON_DROP : 0, 0]} rotation={halfMoon ? HALF_MOON_FLIP : undefined}>
      <mesh geometry={RIMS[style]} material={look.gold} />
      <mesh geometry={GLASS[style]} material={look.lens} />
    </group>
  );
}

export function Spectacles({ look, landmarks, style }: { look: WizardLook; landmarks: Landmarks; style: GlassesStyle }) {
  const z = landmarks.eyeFrontZ + LENS_GAP;
  if (style === "monocle") {
    return (
      <group position={[-landmarks.eyeX, landmarks.eyeY, z]}>
        <Lens style={style} look={look} />
        <mesh geometry={chain} material={look.gold} position={[-LENS_RADIUS, -MONOCLE_CHAIN_DROP / 2 - LENS_RADIUS, -0.01]} />
      </group>
    );
  }
  return (
    <group position={[0, landmarks.eyeY, z]}>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * landmarks.eyeX, 0, 0]}>
          <Lens style={style} look={look} />
          <mesh geometry={arm} material={look.gold} rotation={backward} position={[side * (LENS_RADIUS + 0.004), 0.004, -ARM_LENGTH / 2]} />
        </group>
      ))}
      <mesh geometry={bridge} material={look.gold} rotation={sideways} position={[0, 0.006, 0]} />
    </group>
  );
}
