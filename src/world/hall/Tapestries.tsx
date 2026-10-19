import { useMemo } from "react";
import * as THREE from "three";
import { tapestryTexture } from "./artwork";
import { merged, placed } from "./geometryKit";
import { hallClock } from "./hallClock";
import { gold, wroughtIron } from "./materials";

export type TapestrySpot = { x: number; z: number; turn: number; width: number; height: number };
type Props = { spots: TapestrySpot[] };

const HANG_TOP = 7.5;
const WALL_GAP = 0.06;
const ROD_OVERHANG = 0.14;
const SWAY = 0.025;

const cloth = new THREE.MeshStandardMaterial({ map: tapestryTexture(), roughness: 0.95, alphaTest: 0.5, side: THREE.DoubleSide });
// A slow ripple that grows toward the free bottom edge, so the cloth hangs from its rod instead of standing stiff.
cloth.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = hallClock.uTime;
  shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
    float slack = 1.0 - uv.y;
    vec4 anchor = modelMatrix * vec4(position, 1.0);
    transformed.z += sin(uTime * 0.7 + anchor.x * 1.3 + anchor.z * 0.9 + position.y * 2.0) * ${SWAY} * slack + slack * slack * 0.03;`,
  );
};

export function Tapestries({ spots }: Props) {
  const parts = useMemo(() => {
    const sheets: THREE.BufferGeometry[] = [];
    const rods: THREE.BufferGeometry[] = [];
    const finials: THREE.BufferGeometry[] = [];
    for (const spot of spots) {
      const frame = new THREE.Matrix4().makeRotationY(spot.turn).setPosition(spot.x, 0, spot.z);
      const sheet = new THREE.PlaneGeometry(spot.width, spot.height, 6, 16).translate(0, HANG_TOP - spot.height / 2, WALL_GAP);
      sheets.push(placed(sheet, frame));
      const rodLength = spot.width + ROD_OVERHANG * 2;
      rods.push(placed(new THREE.CylinderGeometry(0.022, 0.022, rodLength, 10).rotateZ(Math.PI / 2).translate(0, HANG_TOP + 0.02, WALL_GAP + 0.02), frame));
      for (const side of [-1, 1]) {
        finials.push(placed(new THREE.SphereGeometry(0.045, 12, 8).translate(side * (rodLength / 2), HANG_TOP + 0.02, WALL_GAP + 0.02), frame));
      }
    }
    return { sheets: merged(sheets), rods: merged(rods), finials: merged(finials) };
  }, [spots]);
  return (
    <group>
      <mesh geometry={parts.sheets} material={cloth} />
      <mesh geometry={parts.rods} material={wroughtIron} />
      <mesh geometry={parts.finials} material={gold} />
    </group>
  );
}
