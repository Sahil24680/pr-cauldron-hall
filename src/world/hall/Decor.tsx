import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { FRONT_EDGE_Z, FRONT_Z, HALL_HALF_WIDTH, WALL_HEIGHT, type Zone } from "../layout";
import { featherTexture } from "../textures";
import { Bookcases } from "./Bookcases";
import { CandleRings } from "./CandleRings";
import { Ceiling, TIE_BEAM_HEIGHT } from "./Ceiling";
import { Chandelier } from "./Chandelier";
import { FloorInlays } from "./FloorInlays";
import { FlyingBooks } from "./FlyingBooks";
import { type GroundShadow, GroundShadows } from "./GroundShadows";
import { Hearth } from "./Hearth";
import { PotionShelf } from "./PotionShelf";
import { Tapestries } from "./Tapestries";
import { WallDressing } from "./WallDressing";
import { nearestTo } from "./geometryKit";

type Props = { zones: Zone[]; backZ: number; bays: number[]; trusses: number[] };

const CHANDELIER_Y = 6.6;
const CANDLE_RING_LIFT = 0.15;
const HEARTH_OFFSET_X = 8.2;
const POTION_SHELF_X = 4.4;
const WALL_SIDES = [-1, 1];
const HEARTH_HALF_SPAN = 2.05;
const CONSOLE_HALF_SPAN = 1.35;
const BACK_WALL_GAPS = [
  { from: -HEARTH_OFFSET_X - HEARTH_HALF_SPAN, to: -HEARTH_OFFSET_X + HEARTH_HALF_SPAN },
  { from: -CONSOLE_HALF_SPAN, to: CONSOLE_HALF_SPAN },
  { from: HEARTH_OFFSET_X - HEARTH_HALF_SPAN, to: HEARTH_OFFSET_X + HEARTH_HALF_SPAN },
];
const TAPESTRY_HEIGHT = 4.4;
const CRATE = { x: -HALL_HALF_WIDTH + 1.2, z: FRONT_EDGE_Z - 1.2 };
const OWLS = [
  { x: -2.8, z: FRONT_EDGE_Z - 0.8, facing: Math.PI + 0.3 },
  { x: 2.8, z: FRONT_EDGE_Z - 0.8, facing: Math.PI - 0.3 },
];

const box = new THREE.BoxGeometry(1, 1, 1);
const barrel = new THREE.CylinderGeometry(0.42, 0.42, 1, 16);
const barrelBand = new THREE.TorusGeometry(0.43, 0.025, 6, 20);
const flat = new THREE.Euler(-Math.PI / 2, 0, 0);

const oak = new THREE.MeshStandardMaterial({ color: "#4a2f1a", roughness: 0.85 });
const darkOak = new THREE.MeshStandardMaterial({ color: "#2e1d10", roughness: 0.9 });
const iron = new THREE.MeshStandardMaterial({ color: "#2b2d31", roughness: 0.45, metalness: 0.75 });

function Barrel({ x, z, tilt = 0 }: { x: number; z: number; tilt?: number }) {
  return (
    <group position={[x, 0.5, z]} rotation={[0, tilt, 0]}>
      <mesh geometry={barrel} material={oak} />
      {[-0.32, 0.32].map((y) => (
        <mesh key={y} geometry={barrelBand} material={iron} rotation={flat} position={[0, y, 0]} />
      ))}
    </group>
  );
}

const OWL_BLINK_SECONDS = 0.14;

const owlParts = {
  body: new THREE.SphereGeometry(1, 20, 16),
  disc: new THREE.SphereGeometry(1, 18, 12),
  discRim: new THREE.TorusGeometry(0.075, 0.012, 6, 20),
  eye: new THREE.SphereGeometry(0.045, 16, 12),
  pupil: new THREE.SphereGeometry(0.022, 10, 8),
  glint: new THREE.SphereGeometry(0.007, 6, 4),
  lid: new THREE.SphereGeometry(0.049, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  beak: new THREE.ConeGeometry(0.024, 0.07, 8),
  tuft: new THREE.ConeGeometry(0.035, 0.11, 6),
  tail: new THREE.ConeGeometry(0.09, 0.2, 8),
  talon: new THREE.ConeGeometry(0.011, 0.05, 5),
  perchBar: new THREE.CylinderGeometry(0.035, 0.035, 0.7, 10),
  post: new THREE.CylinderGeometry(0.05, 0.07, 1.6, 10),
  base: new THREE.CylinderGeometry(0.28, 0.34, 0.08, 16),
};

function useOwlMaterials() {
  return useMemo(
    () => ({
      plumage: new THREE.MeshStandardMaterial({ map: featherTexture("#7a5a3a", "#4a3220", "#e8dcc4"), roughness: 0.95 }),
      chest: new THREE.MeshStandardMaterial({ map: featherTexture("#d9c7a5", "#a88a62", "#5a3e26"), roughness: 0.95 }),
      wing: new THREE.MeshStandardMaterial({ map: featherTexture("#5e432a", "#2e1f12", "#c9b28a"), roughness: 0.95 }),
      face: new THREE.MeshStandardMaterial({ color: "#e6d7b8", roughness: 0.9 }),
      rim: new THREE.MeshStandardMaterial({ color: "#4a3220", roughness: 0.9 }),
      iris: new THREE.MeshStandardMaterial({ color: "#f0a020", roughness: 0.2, emissive: "#6b3a00", emissiveIntensity: 0.4 }),
      pupil: new THREE.MeshStandardMaterial({ color: "#0b0806", roughness: 0.1 }),
      glint: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      beak: new THREE.MeshStandardMaterial({ color: "#3a3532", roughness: 0.4 }),
    }),
    [],
  );
}

function Owl({ x, z, facing }: { x: number; z: number; facing: number }) {
  const materials = useOwlMaterials();
  const head = useRef<THREE.Group>(null);
  const lids = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const behaviour = useRef({
    look: 0,
    lookTarget: 0,
    nextLook: 2 + Math.random() * 3,
    nextBlink: 1 + Math.random() * 3,
    blinkUntil: 0,
    nextRuffle: 6 + Math.random() * 6,
    ruffleUntil: 0,
  });

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const t = state.clock.elapsedTime;
    const b = behaviour.current;
    if (t > b.nextLook) {
      const halfTurn = Math.random() < 0.2;
      b.lookTarget = halfTurn ? Math.sign(Math.random() - 0.5) * 2.6 : (Math.random() - 0.5) * 1.6;
      b.nextLook = t + 2.5 + Math.random() * 4;
    }
    b.look += (b.lookTarget - b.look) * Math.min(1, delta * 5);
    if (head.current) {
      head.current.rotation.set(Math.sin(t * 0.7) * 0.05, b.look, Math.sin(t * 0.45) * 0.08);
    }
    if (t > b.nextBlink) {
      b.blinkUntil = t + OWL_BLINK_SECONDS;
      b.nextBlink = t + 2 + Math.random() * 4;
    }
    for (const lid of lids.current?.children ?? []) {
      lid.scale.y = t < b.blinkUntil ? 1 : 0.05;
    }
    if (t > b.nextRuffle) {
      b.ruffleUntil = t + 0.6;
      b.nextRuffle = t + 8 + Math.random() * 8;
    }
    const ruffle = t < b.ruffleUntil ? Math.sin((b.ruffleUntil - t) * 30) * 0.05 : 0;
    body.current?.scale.set(1 + ruffle, 1 + Math.sin(t * 1.8) * 0.012, 1 + ruffle);
  });

  return (
    <group position={[x, 0, z]} rotation={[0, facing, 0]}>
      <mesh geometry={owlParts.base} material={darkOak} position={[0, 0.04, 0]} />
      <mesh geometry={owlParts.post} material={darkOak} position={[0, 0.85, 0]} />
      <mesh geometry={owlParts.perchBar} material={darkOak} rotation={[0, 0, Math.PI / 2]} position={[0, 1.66, 0]} />
      <group position={[0, 1.7, 0]}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.07, 0, 0.03]}>
            {[-0.025, 0, 0.025].map((spread) => (
              <mesh
                key={spread}
                geometry={owlParts.talon}
                material={materials.beak}
                position={[spread, -0.02, 0.035]}
                rotation={[Math.PI / 2 + 0.6, 0, spread * 6]}
              />
            ))}
          </group>
        ))}
        <group ref={body} position={[0, 0.27, 0]}>
          <mesh geometry={owlParts.body} material={materials.plumage} scale={[0.2, 0.27, 0.18]} />
          <mesh geometry={owlParts.body} material={materials.chest} scale={[0.15, 0.22, 0.08]} position={[0, -0.02, 0.11]} />
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              geometry={owlParts.body}
              material={materials.wing}
              scale={[0.07, 0.22, 0.15]}
              position={[side * 0.16, -0.02, -0.02]}
              rotation={[0.15, 0, side * 0.12]}
            />
          ))}
          <mesh geometry={owlParts.tail} material={materials.wing} position={[0, -0.27, -0.1]} rotation={[-2.6, 0, 0]} />
        </group>
        <group ref={head} position={[0, 0.6, 0.01]}>
          <mesh geometry={owlParts.body} material={materials.plumage} scale={[0.19, 0.16, 0.16]} />
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh geometry={owlParts.disc} material={materials.face} scale={[0.075, 0.08, 0.03]} position={[side * 0.068, 0.0, 0.135]} />
              <mesh geometry={owlParts.discRim} material={materials.rim} position={[side * 0.068, 0, 0.14]} />
              <mesh geometry={owlParts.eye} material={materials.iris} position={[side * 0.065, 0.005, 0.15]} />
              <mesh geometry={owlParts.pupil} material={materials.pupil} position={[side * 0.065, 0.005, 0.188]} />
              <mesh geometry={owlParts.glint} material={materials.glint} position={[side * 0.065 + 0.012, 0.018, 0.195]} />
              <mesh geometry={owlParts.tuft} material={materials.plumage} position={[side * 0.12, 0.15, 0.02]} rotation={[-0.2, 0, -side * 0.45]} />
            </group>
          ))}
          <group ref={lids}>
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                geometry={owlParts.lid}
                material={materials.plumage}
                position={[side * 0.065, 0.005, 0.15]}
                rotation={[Math.PI / 2 - 0.4, 0, 0]}
                scale={[1, 0.05, 1]}
              />
            ))}
          </group>
          <mesh geometry={owlParts.beak} material={materials.beak} position={[0, -0.04, 0.17]} rotation={[Math.PI / 2 + 0.6, 0, 0]} />
        </group>
      </group>
    </group>
  );
}

function shadowsUnder(backZ: number, bays: number[], trusses: number[], barrels: { x: number; z: number }[]): GroundShadow[] {
  const bookcases = bays.flatMap((z) => WALL_SIDES.map((side) => ({ x: side * (HALL_HALF_WIDTH - 0.3), z, width: 1, depth: 3.1 })));
  const hearths = WALL_SIDES.map((side) => ({ x: side * HEARTH_OFFSET_X, z: backZ + 1, width: 4, depth: 1.5 }));
  const pillars = trusses.flatMap((z) => WALL_SIDES.map((side) => ({ x: side * (HALL_HALF_WIDTH - 0.45), z, width: 1.6, depth: 1.6 })));
  const crates = [{ x: CRATE.x, z: CRATE.z, width: 1.5, depth: 1.5 }];
  const owls = OWLS.map((owl) => ({ x: owl.x, z: owl.z, width: 0.9, depth: 0.9 }));
  return [...bookcases, ...hearths, ...pillars, ...crates, ...owls, ...barrels.map((barrel) => ({ ...barrel, width: 1.3, depth: 1.3 }))];
}

export function Decor({ zones, backZ, bays, trusses }: Props) {
  const chandelierZ = nearestTo(trusses, FRONT_Z - 1);
  const candleRings = useMemo(() => zones.map((zone) => new THREE.Vector3(zone.x, CHANDELIER_Y + CANDLE_RING_LIFT, chandelierZ)), [zones, chandelierZ]);
  const bookcaseSpots = useMemo(() => bays.flatMap((z) => WALL_SIDES.map((side) => ({ z, side }))), [bays]);
  const barrels = useMemo(
    () => [
      { x: HALL_HALF_WIDTH - 1.2, z: FRONT_EDGE_Z - 1.2, tilt: 0 },
      { x: HALL_HALF_WIDTH - 2.1, z: FRONT_EDGE_Z - 1, tilt: 0.6 },
      { x: -HALL_HALF_WIDTH + 1.2, z: backZ + 2.2, tilt: 0 },
    ],
    [backZ],
  );
  const tapestries = useMemo(
    () => [
      ...WALL_SIDES.map((side) => ({ x: side * HALL_HALF_WIDTH * 0.48, z: FRONT_EDGE_Z, turn: Math.PI, width: 1.9, height: TAPESTRY_HEIGHT })),
      ...WALL_SIDES.map((side) => ({ x: side * (HALL_HALF_WIDTH - 1.3), z: backZ, turn: 0, width: 1.6, height: TAPESTRY_HEIGHT })),
    ],
    [backZ],
  );
  const groundShadows = useMemo(() => shadowsUnder(backZ, bays, trusses, barrels), [backZ, bays, trusses, barrels]);
  return (
    <group>
      <Ceiling backZ={backZ} trusses={trusses} />
      <Bookcases spots={bookcaseSpots} />
      <PotionShelf x={-POTION_SHELF_X} backZ={backZ} seed={11} />
      <PotionShelf x={POTION_SHELF_X} backZ={backZ} seed={29} />
      <Hearth x={-HEARTH_OFFSET_X} backZ={backZ} withPot seed={3} />
      <Hearth x={HEARTH_OFFSET_X} backZ={backZ} withPot={false} seed={5} />
      {zones.map((zone) => (
        <Chandelier key={zone.stage} x={zone.x} z={chandelierZ} hookY={WALL_HEIGHT - TIE_BEAM_HEIGHT / 2} bodyY={CHANDELIER_Y} />
      ))}
      <CandleRings centers={candleRings} />
      {barrels.map((barrel) => (
        <Barrel key={`${barrel.x}-${barrel.z}`} x={barrel.x} z={barrel.z} tilt={barrel.tilt} />
      ))}
      <mesh geometry={box} material={oak} scale={[0.9, 0.9, 0.9]} position={[CRATE.x, 0.45, CRATE.z]} rotation={[0, 0.3, 0]} />
      <mesh geometry={box} material={oak} scale={[0.6, 0.6, 0.6]} position={[CRATE.x + 0.05, 1.2, CRATE.z + 0.05]} rotation={[0, -0.2, 0]} />
      {OWLS.map((owl) => (
        <Owl key={owl.x} x={owl.x} z={owl.z} facing={owl.facing} />
      ))}
      <GroundShadows shadows={groundShadows} />
      <WallDressing backZ={backZ} bays={bays} backWallGaps={BACK_WALL_GAPS} />
      <Tapestries spots={tapestries} />
      <FloorInlays zones={zones} />
      <FlyingBooks backZ={backZ} />
    </group>
  );
}
