import { useMemo } from "react";
import { FRONT_EDGE_Z, HALL_HALF_WIDTH } from "../layout";
import { GroundFog } from "./GroundFog";
import { MoonShafts } from "./MoonShafts";
import { createDriftGeometry, createDriftMaterial } from "./particles";

type Props = { backZ: number; bays: number[] };

const DUST_MOTES = 220;
const MAGIC_SPARKS = 70;
const DUST_FLOOR = 0.6;
const DUST_CEILING = 7.5;
const WALL_CLEARANCE = 1;

const dust = createDriftMaterial({
  color: "#ffd9a0",
  velocity: [0.02, 0.01, -0.01],
  wander: 0.6,
  life: 18,
  size: 0.022,
  opacity: 0.45,
  twinkle: 0.3,
  shape: "soft",
  additive: true,
});
const sparks = createDriftMaterial({
  color: "#fff0c0",
  colorEnd: "#b8a4ff",
  velocity: [0, 0.06, 0],
  wander: 0.5,
  life: 9,
  size: 0.045,
  opacity: 0.85,
  twinkle: 0.85,
  shape: "star",
  additive: true,
});

export function Atmosphere({ backZ, bays }: Props) {
  const spawns = useMemo(() => {
    const spread = HALL_HALF_WIDTH - WALL_CLEARANCE;
    const inHall = (random: () => number): [number, number, number] => [
      (random() * 2 - 1) * spread,
      DUST_FLOOR + random() * (DUST_CEILING - DUST_FLOOR),
      backZ + WALL_CLEARANCE + random() * (FRONT_EDGE_Z - backZ - WALL_CLEARANCE * 2),
    ];
    return { dust: createDriftGeometry(DUST_MOTES, 43, inHall), sparks: createDriftGeometry(MAGIC_SPARKS, 47, inHall) };
  }, [backZ]);
  return (
    <group>
      <points geometry={spawns.dust} material={dust} frustumCulled={false} />
      <points geometry={spawns.sparks} material={sparks} frustumCulled={false} />
      <MoonShafts bays={bays} />
      <GroundFog backZ={backZ} />
    </group>
  );
}
