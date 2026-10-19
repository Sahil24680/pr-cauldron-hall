import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { hallReflections, toTexture } from "../textures";
import { type BillboardSize, Billboards } from "./Billboards";
import { WritingQuill } from "./WritingQuill";
import { PAINTING_ASPECT, PAINTING_STAFF_TIP, cloudCanvas, paintingCanvas } from "./artwork";
import { type Profile, lathe, merged, placed, woodBlock } from "./geometryKit";
import { billboardQuad, createGlowMaterial } from "./glowShaders";
import { gold, masonry, sealBrass } from "./materials";
import { createDriftGeometry, createDriftMaterial } from "./particles";

type Props = { backZ: number };

const CANVAS_HEIGHT = 4.5;
const CANVAS_WIDTH = CANVAS_HEIGHT * PAINTING_ASPECT;
const CANVAS_CENTRE_Y = 4.65;
const FRAME_WIDTH = 0.3;
const FRAME_DEPTH = 0.12;
const WALL_OFFSET = 0.06;
const CANVAS_INSET = 0.03;
const TWINKLING_STAR = { u: 0.42, v: 0.12 };
const CLOUD_SHARE = 0.4;
const CLOUD_DRIFT = 0.006;
const CONSOLE = { width: 2.6, depth: 0.55, top: 1.05, slab: 0.09 };
const STAFF_GLOW_SIZES: BillboardSize[] = [[0.9, 0.9]];
const ROSETTE: Profile = [
  [0, 0],
  [0.09, 0],
  [0.1, 0.02],
  [0.07, 0.04],
  [0.04, 0.07],
  [0, 0.08],
];

const varnish = new THREE.MeshPhysicalMaterial({
  map: toTexture(paintingCanvas(), true),
  roughness: 0.55,
  clearcoat: 0.7,
  clearcoatRoughness: 0.22,
  envMap: hallReflections(),
  envMapIntensity: 0.35,
});
varnish.emissiveMap = varnish.map;
varnish.emissive = new THREE.Color("#ffffff");
varnish.emissiveIntensity = 0.32;
const cloudTexture = toTexture(cloudCanvas(), true);
const clouds = new THREE.MeshBasicMaterial({ map: cloudTexture, transparent: true, depthWrite: false, opacity: 0.85 });
const staffGlow = createGlowMaterial({ color: "#9fe8ff", intensity: 0.55, pulse: 0.25 });
const starGlint = createDriftMaterial({
  color: new THREE.Color(2.2, 2.2, 2.4),
  velocity: [0, 0, 0],
  wander: 0,
  life: 5,
  size: 0.12,
  opacity: 1,
  twinkle: 1,
  shape: "star",
  additive: true,
});

function buildFrame() {
  const gilt: THREE.BufferGeometry[] = [];
  const outerWidth = CANVAS_WIDTH + FRAME_WIDTH * 2;
  const outerHeight = CANVAS_HEIGHT + FRAME_WIDTH * 2;
  const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
  const rail = (length: number, radius: number) => new THREE.CylinderGeometry(radius, radius, length, 10);
  for (const side of [-1, 1]) {
    const x = side * (CANVAS_WIDTH / 2 + FRAME_WIDTH / 2);
    const y = side * (CANVAS_HEIGHT / 2 + FRAME_WIDTH / 2);
    gilt.push(placed(woodBlock(FRAME_WIDTH, outerHeight, FRAME_DEPTH), at(x, 0, 0)));
    gilt.push(placed(woodBlock(outerWidth, FRAME_WIDTH, FRAME_DEPTH), at(0, y, 0)));
    gilt.push(placed(rail(outerHeight, 0.045), at(side * (outerWidth / 2 - 0.04), 0, FRAME_DEPTH / 2)));
    gilt.push(placed(rail(outerWidth, 0.045).rotateZ(Math.PI / 2), at(0, side * (outerHeight / 2 - 0.04), FRAME_DEPTH / 2)));
    gilt.push(placed(rail(CANVAS_HEIGHT, 0.028), at(side * (CANVAS_WIDTH / 2 + 0.03), 0, FRAME_DEPTH / 2 + 0.01)));
    gilt.push(placed(rail(CANVAS_WIDTH, 0.028).rotateZ(Math.PI / 2), at(0, side * (CANVAS_HEIGHT / 2 + 0.03), FRAME_DEPTH / 2 + 0.01)));
    for (const flip of [-1, 1]) {
      const rosette = lathe(ROSETTE, 16).rotateX(Math.PI / 2);
      gilt.push(placed(rosette, at(flip * (CANVAS_WIDTH / 2 + FRAME_WIDTH / 2), side * (CANVAS_HEIGHT / 2 + FRAME_WIDTH / 2), FRAME_DEPTH / 2)));
    }
  }
  const crest = new THREE.Shape();
  crest.moveTo(-0.7, 0);
  crest.quadraticCurveTo(-0.65, 0.3, -0.3, 0.32);
  crest.quadraticCurveTo(0, 0.62, 0.3, 0.32);
  crest.quadraticCurveTo(0.65, 0.3, 0.7, 0);
  crest.closePath();
  const cartouche = new THREE.ExtrudeGeometry(crest, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 });
  gilt.push(placed(cartouche, at(0, outerHeight / 2 - 0.05, -0.02)));
  const medallion = placed(new THREE.CircleGeometry(0.17, 32), at(0, outerHeight / 2 + 0.24, 0.07));
  return { gilt: merged(gilt), medallion };
}

function buildConsole() {
  const stone: THREE.BufferGeometry[] = [];
  stone.push(
    placed(woodBlock(CONSOLE.width, CONSOLE.slab, CONSOLE.depth), new THREE.Matrix4().makeTranslation(0, CONSOLE.top - CONSOLE.slab / 2, CONSOLE.depth / 2)),
  );
  for (const side of [-1, 1]) {
    const support = new THREE.Shape();
    support.moveTo(0, 0);
    support.lineTo(0.3, 0);
    support.quadraticCurveTo(0.12, 0.35, 0.36, 0.7);
    support.lineTo(0.42, CONSOLE.top - CONSOLE.slab);
    support.lineTo(0, CONSOLE.top - CONSOLE.slab);
    support.closePath();
    const slab = new THREE.ExtrudeGeometry(support, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
    stone.push(placed(slab.rotateY(-Math.PI / 2), new THREE.Matrix4().makeTranslation(side * (CONSOLE.width / 2 - 0.25) + 0.08, 0, 0.02)));
  }
  return merged(stone);
}

export function Painting({ backZ }: Props) {
  const parts = useMemo(() => ({ frame: buildFrame(), console: buildConsole() }), []);
  const effects = useMemo(() => {
    const onCanvas = (u: number, v: number) => new THREE.Vector3((u - 0.5) * CANVAS_WIDTH, (0.5 - v) * CANVAS_HEIGHT, CANVAS_INSET + 0.01);
    const star = onCanvas(TWINKLING_STAR.u, TWINKLING_STAR.v);
    return {
      staff: [onCanvas(PAINTING_STAFF_TIP.u, PAINTING_STAFF_TIP.v)],
      star: createDriftGeometry(1, 3, () => [star.x, star.y, star.z]),
    };
  }, []);
  useFrame((state) => {
    cloudTexture.offset.x = state.clock.elapsedTime * CLOUD_DRIFT;
  });
  return (
    <group position={[0, 0, backZ]}>
      <group position={[0, CANVAS_CENTRE_Y, WALL_OFFSET]}>
        <mesh geometry={parts.frame.gilt} material={gold} />
        <mesh geometry={parts.frame.medallion} material={sealBrass} />
        <mesh material={varnish} position={[0, 0, CANVAS_INSET]}>
          <planeGeometry args={[CANVAS_WIDTH, CANVAS_HEIGHT]} />
        </mesh>
        <mesh material={clouds} position={[0, CANVAS_HEIGHT * (0.5 - CLOUD_SHARE / 2), CANVAS_INSET + 0.004]}>
          <planeGeometry args={[CANVAS_WIDTH, CANVAS_HEIGHT * CLOUD_SHARE]} />
        </mesh>
        <Billboards at={effects.staff} sizes={STAFF_GLOW_SIZES} geometry={billboardQuad} material={staffGlow} />
        <points geometry={effects.star} material={starGlint} frustumCulled={false} />
      </group>
      <mesh geometry={parts.console} material={masonry} />
      <WritingQuill deskTop={CONSOLE.top} deskDepth={CONSOLE.depth} />
    </group>
  );
}
