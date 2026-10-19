import { Stars } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Stage } from "../../../shared/board";
import { STAGE_THEMES } from "../../lib/theme";
import { SceneLabel } from "../labels/SceneLabel";
import { FRONT_EDGE_Z, FRONT_Z, HALL_HALF_WIDTH, WALL_HEIGHT, type Zone } from "../layout";
import { stoneTextures } from "../textures";
import { Atmosphere } from "./Atmosphere";
import { Decor } from "./Decor";
import { HallTrim } from "./HallTrim";
import { Painting } from "./Painting";
import { Torch } from "./Torch";
import { ZoneCrests } from "./ZoneCrest";
import { merged, nearestTo, placed } from "./geometryKit";
import { useHallClock } from "./hallClock";
import { trimStone } from "./materials";

type Props = { zones: Zone[]; backZ: number; counts: Record<Stage, number>; onPickZone: (stage: Stage) => void };

const WALL_THICKNESS = 0.6;
const BAY_SPACING = 6;
const PILLAR_INSET = 0.45;
const PILLAR_RADIUS = 0.32;
const TORCH_Y = 3.4;
const LIT_TORCH_EVERY = 2;
const WALL_TEXTURE_METERS = 3;
const FLOOR_TEXTURE_METERS = 4;
const COLONNETTES = 4;
const COLONNETTE_RADIUS = 0.08;
const PILLAR_BASE_TOP = 0.4;
const PILLAR_CAPITAL_DROP = 0.95;
const CREST_BEHIND_ZONE = 0.4;

const box = new THREE.BoxGeometry(1, 1, 1);
const pillarShaft = new THREE.CylinderGeometry(PILLAR_RADIUS, PILLAR_RADIUS * 1.08, 1, 14);
const archTop = new THREE.CircleGeometry(0.75, 20, 0, Math.PI);
const coldPot = new THREE.CylinderGeometry(0.58, 0.44, 0.72, 16, 1, true);
const coldRim = new THREE.TorusGeometry(0.58, 0.06, 8, 20);

const darkWood = new THREE.MeshStandardMaterial({ color: "#3d2716", roughness: 0.8 });
const iron = new THREE.MeshStandardMaterial({ color: "#2b2d31", roughness: 0.5, metalness: 0.7 });
const goldTrim = new THREE.MeshStandardMaterial({ color: "#c79a3b", roughness: 0.35, metalness: 0.8 });
const windowGlass = new THREE.MeshBasicMaterial({ color: "#4a6fc0", toneMapped: false });
const windowGlassHalf = new THREE.MeshBasicMaterial({ color: "#4a6fc0", toneMapped: false, side: THREE.DoubleSide });
const coldIron = new THREE.MeshStandardMaterial({ color: "#2c2e33", roughness: 0.55, metalness: 0.6, side: THREE.DoubleSide });

function bayPositions(from: number, to: number) {
  const zs: number[] = [];
  for (let z = from; z > to; z -= BAY_SPACING) {
    zs.push(z);
  }
  return zs;
}

function ColdCauldron({ zone }: { zone: Zone }) {
  const theme = STAGE_THEMES[zone.stage];
  const rim = useMemo(() => new THREE.MeshStandardMaterial({ color: theme.banner, roughness: 0.95 }), [theme.banner]);
  return (
    <group position={[zone.x, 0, FRONT_Z]}>
      <mesh geometry={coldPot} material={coldIron} position={[0, 0.48, 0]} />
      <mesh geometry={coldRim} material={rim} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.84, 0]} />
      <SceneLabel position={[0, 1.5, 0]}>
        <div className="tag">Nothing brewing</div>
      </SceneLabel>
    </group>
  );
}

function buildPillarDetail() {
  const pieces: THREE.BufferGeometry[] = [];
  const shaftHeight = WALL_HEIGHT - PILLAR_CAPITAL_DROP - PILLAR_BASE_TOP;
  for (let shaft = 0; shaft < COLONNETTES; shaft++) {
    const angle = Math.PI / 4 + (shaft / COLONNETTES) * Math.PI * 2;
    const colonnette = new THREE.CylinderGeometry(COLONNETTE_RADIUS, COLONNETTE_RADIUS, shaftHeight, 10);
    pieces.push(
      placed(
        colonnette,
        new THREE.Matrix4().makeTranslation(Math.cos(angle) * PILLAR_RADIUS, PILLAR_BASE_TOP + shaftHeight / 2, Math.sin(angle) * PILLAR_RADIUS),
      ),
    );
  }
  const ring = (radius: number, thickness: number, y: number) =>
    placed(new THREE.TorusGeometry(radius, thickness, 8, 28).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(0, y, 0));
  pieces.push(ring(0.42, 0.06, PILLAR_BASE_TOP - 0.02), ring(0.38, 0.04, PILLAR_BASE_TOP + 0.08));
  pieces.push(ring(0.4, 0.05, WALL_HEIGHT - PILLAR_CAPITAL_DROP), ring(0.36, 0.03, WALL_HEIGHT - PILLAR_CAPITAL_DROP - 0.12));
  pieces.push(
    placed(new THREE.CylinderGeometry(0.44, PILLAR_RADIUS, 0.4, 16), new THREE.Matrix4().makeTranslation(0, WALL_HEIGHT - PILLAR_CAPITAL_DROP + 0.22, 0)),
  );
  return merged(pieces);
}

const pillarDetail = buildPillarDetail();

function Pillar({ side, z, index }: { side: number; z: number; index: number }) {
  const x = side * (HALL_HALF_WIDTH - PILLAR_INSET);
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={box} material={trimStone} scale={[0.95, 0.35, 0.95]} position={[0, 0.175, 0]} />
      <mesh geometry={pillarShaft} material={trimStone} scale={[1, WALL_HEIGHT - 1.2, 1]} position={[0, WALL_HEIGHT / 2, 0]} />
      <mesh geometry={pillarDetail} material={trimStone} />
      <mesh geometry={box} material={trimStone} scale={[0.9, 0.3, 0.9]} position={[0, WALL_HEIGHT - 0.45, 0]} />
      <group position={[-side * PILLAR_RADIUS, TORCH_Y, 0]} rotation={[0, -side * (Math.PI / 2), 0]}>
        <Torch lit={index % LIT_TORCH_EVERY === 0} hue={index + (side > 0 ? 1 : 0)} />
      </group>
    </group>
  );
}

function ArchedWindow({ side, z }: { side: number; z: number }) {
  return (
    <group position={[side * (HALL_HALF_WIDTH - 0.01), 0, z]} rotation={[0, -side * (Math.PI / 2), 0]}>
      <mesh geometry={box} material={windowGlass} scale={[1.5, 3.6, 0.02]} position={[0, 4.4, 0]} />
      <mesh geometry={archTop} material={windowGlassHalf} position={[0, 6.2, 0]} />
      <mesh geometry={box} material={iron} scale={[0.06, 4.4, 0.05]} position={[0, 4.6, 0.02]} />
      <mesh geometry={box} material={iron} scale={[1.5, 0.05, 0.05]} position={[0, 4.6, 0.02]} />
      <mesh geometry={box} material={iron} scale={[1.5, 0.05, 0.05]} position={[0, 5.6, 0.02]} />
      <mesh geometry={box} material={trimStone} scale={[1.9, 0.18, 0.35]} position={[0, 2.55, 0.12]} />
    </group>
  );
}

export function Hall({ zones, backZ, counts, onPickZone }: Props) {
  const depth = FRONT_EDGE_Z - backZ;
  const centerZ = (FRONT_EDGE_Z + backZ) / 2;
  const width = HALL_HALF_WIDTH * 2;
  const materials = useMemo(() => {
    const stone = (repeatX: number, repeatY: number) => {
      const { map, bump } = stoneTextures("wall", repeatX, repeatY);
      return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2.5, roughness: 0.95 });
    };
    const floor = stoneTextures("floor", width / FLOOR_TEXTURE_METERS, depth / FLOOR_TEXTURE_METERS);
    return {
      sideWall: stone(depth / WALL_TEXTURE_METERS, WALL_HEIGHT / WALL_TEXTURE_METERS),
      endWall: stone(width / WALL_TEXTURE_METERS, WALL_HEIGHT / WALL_TEXTURE_METERS),
      floor: new THREE.MeshStandardMaterial({ map: floor.map, bumpMap: floor.bump, bumpScale: 2, roughness: 0.72, metalness: 0.05 }),
    };
  }, [depth, width]);
  const bays = useMemo(() => bayPositions(FRONT_EDGE_Z - BAY_SPACING / 2, backZ + 1), [backZ]);
  const pillars = useMemo(() => bayPositions(FRONT_EDGE_Z - 0.6, backZ + 0.5), [backZ]);
  const crestZ = useMemo(() => nearestTo(pillars, Math.min(...zones.map((zone) => zone.endZ)) - CREST_BEHIND_ZONE), [pillars, zones]);
  const moon = useRef<THREE.DirectionalLight>(null);
  useHallClock();
  useLayoutEffect(() => {
    const light = moon.current;
    if (!light) {
      return;
    }
    light.target.position.set(0, 0, centerZ);
    light.target.updateMatrixWorld();
  }, [centerZ]);

  return (
    <group>
      <color attach="background" args={["#070b1c"]} />
      <fog attach="fog" args={["#0a0f24", 22, 75]} />
      <Stars radius={90} depth={40} count={2500} factor={4} saturation={0} fade speed={0.6} />
      <ambientLight intensity={0.25} color="#ffe2b8" />
      <hemisphereLight args={["#7d93e0", "#3a2a1c", 0.45]} />
      <directionalLight ref={moon} position={[-10, 24, centerZ + 8]} intensity={1.25} color="#cfd8ff" />

      <mesh material={materials.floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, centerZ]}>
        <planeGeometry args={[width, depth]} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            geometry={box}
            material={materials.sideWall}
            scale={[WALL_THICKNESS, WALL_HEIGHT, depth]}
            position={[side * (HALL_HALF_WIDTH + WALL_THICKNESS / 2), WALL_HEIGHT / 2, centerZ]}
          />
          <mesh geometry={box} material={trimStone} scale={[0.25, 0.35, depth]} position={[side * (HALL_HALF_WIDTH - 0.1), 0.175, centerZ]} />
          <mesh geometry={box} material={trimStone} scale={[0.4, 0.3, depth]} position={[side * (HALL_HALF_WIDTH - 0.15), WALL_HEIGHT - 0.15, centerZ]} />
          {bays.map((z) => (
            <ArchedWindow key={z} side={side} z={z} />
          ))}
          {pillars.map((z, index) => (
            <Pillar key={z} side={side} z={z} index={index} />
          ))}
        </group>
      ))}

      <mesh
        geometry={box}
        material={materials.endWall}
        scale={[width + WALL_THICKNESS * 2, WALL_HEIGHT, WALL_THICKNESS]}
        position={[0, WALL_HEIGHT / 2, backZ - WALL_THICKNESS / 2]}
      />
      <Painting backZ={backZ} />
      <mesh
        geometry={box}
        material={materials.endWall}
        scale={[width + WALL_THICKNESS * 2, WALL_HEIGHT, WALL_THICKNESS]}
        position={[0, WALL_HEIGHT / 2, FRONT_EDGE_Z + WALL_THICKNESS / 2]}
      />
      <group position={[0, 0, FRONT_EDGE_Z - 0.05]}>
        <mesh geometry={box} material={trimStone} scale={[4, 5.6, 0.2]} position={[0, 2.8, 0]} />
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.82, 0, -0.08]}>
            <mesh geometry={box} material={darkWood} scale={[1.6, 5, 0.12]} position={[0, 2.5, 0]} />
            {[1.2, 2.5, 3.8].map((y) => (
              <mesh key={y} geometry={box} material={iron} scale={[1.62, 0.1, 0.14]} position={[0, y, 0]} />
            ))}
            <mesh geometry={box} material={goldTrim} scale={[0.1, 0.1, 0.18]} position={[-side * 0.62, 2.4, 0]} />
          </group>
        ))}
      </group>

      {zones
        .filter((zone) => counts[zone.stage] === 0)
        .map((zone) => (
          <ColdCauldron key={zone.stage} zone={zone} />
        ))}
      <ZoneCrests zones={zones} z={crestZ} counts={counts} onPickZone={onPickZone} />
      <HallTrim backZ={backZ} bays={bays} />
      <Atmosphere backZ={backZ} bays={bays} />
      <Decor zones={zones} backZ={backZ} bays={bays} trusses={pillars} />
    </group>
  );
}
