import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FRONT_EDGE_Z } from "../layout";
import { seededRandom } from "../textures";
import { woodBlock } from "./geometryKit";
import { createDriftGeometry, createDriftMaterial } from "./particles";

type Props = { backZ: number };
type Loop = { centreZ: number; radiusX: number; radiusZ: number; height: number; books: number; speed: number };

// Both loops stay at least a metre clear of the chandeliers' candle rings, the crests and the tie beams.
const loopsFor = (backZ: number): Loop[] => [
  { centreZ: FRONT_EDGE_Z - 6, radiusX: 8, radiusZ: 4, height: 7.3, books: 6, speed: 0.075 },
  { centreZ: backZ + 2.9, radiusX: 7.5, radiusZ: 1.7, height: 7.1, books: 4, speed: -0.09 },
];
const COVER = { width: 0.17, thickness: 0.012, length: 0.24 };
const PAGES = { width: 0.155, thickness: 0.02, length: 0.225 };
const FLAP = { open: 0.55, swing: 0.45, rate: 5.5 };
const BOB = { height: 0.25, rate: 0.6 };
const BANK = 0.25;
const SPREAD = 0.35;
const TRAIL_SPARKS = 50;
const COVER_COLORS = ["#6b1f24", "#1f3b6b", "#2e5b3a", "#5a1f3d", "#6b4a1f", "#3d2a5a"];

const coverLook = new THREE.MeshStandardMaterial({ roughness: 0.7 });
const pageLook = new THREE.MeshStandardMaterial({ color: "#e8dcbc", roughness: 0.9 });
const trail = createDriftMaterial({
  color: "#ffe6a8",
  colorEnd: "#b9a0ff",
  velocity: [0, -0.15, 0],
  wander: 0.4,
  life: 4,
  size: 0.035,
  opacity: 0.9,
  twinkle: 0.7,
  shape: "star",
  additive: true,
});

function half(side: number, width: number, thickness: number, length: number, lift: number) {
  return woodBlock(width, thickness, length).translate((side * width) / 2, lift, 0);
}

const halves = {
  coverLeft: half(1, COVER.width, COVER.thickness, COVER.length, 0),
  coverRight: half(-1, COVER.width, COVER.thickness, COVER.length, 0),
  pagesLeft: half(1, PAGES.width, PAGES.thickness, PAGES.length, (COVER.thickness + PAGES.thickness) / 2),
  pagesRight: half(-1, PAGES.width, PAGES.thickness, PAGES.length, (COVER.thickness + PAGES.thickness) / 2),
};

function pointOnLoop(loop: Loop, angle: number, target: THREE.Vector3) {
  return target.set(Math.cos(angle) * loop.radiusX, loop.height, loop.centreZ + Math.sin(angle) * loop.radiusZ);
}

// Open books flap their covers like wings while they circle under the enchanted ceiling.
export function FlyingBooks({ backZ }: Props) {
  const loops = useMemo(() => loopsFor(backZ), [backZ]);
  const flock = useMemo(() => {
    const random = seededRandom(281);
    return loops.flatMap((loop) =>
      Array.from({ length: loop.books }, (_, index) => ({
        loop,
        offset: (index / loop.books) * Math.PI * 2 + (random() - 0.5) * SPREAD,
        lift: (random() - 0.5) * 0.6,
        phase: random() * Math.PI * 2,
        color: new THREE.Color(COVER_COLORS[Math.floor(random() * COVER_COLORS.length)] ?? "#6b1f24"),
      })),
    );
  }, [loops]);
  const sparks = useMemo(
    () =>
      createDriftGeometry(TRAIL_SPARKS, 283, (random) => {
        const loop = loops[Math.floor(random() * loops.length)] ?? loops[0];
        const point = loop ? pointOnLoop(loop, random() * Math.PI * 2, new THREE.Vector3()) : new THREE.Vector3();
        return [point.x, point.y - 0.1, point.z];
      }),
    [loops],
  );
  const coverLeft = useRef<THREE.InstancedMesh>(null);
  const coverRight = useRef<THREE.InstancedMesh>(null);
  const pagesLeft = useRef<THREE.InstancedMesh>(null);
  const pagesRight = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(
    () => ({
      body: new THREE.Matrix4(),
      wing: new THREE.Matrix4(),
      hinge: new THREE.Matrix4(),
      at: new THREE.Vector3(),
      ahead: new THREE.Vector3(),
      look: new THREE.Matrix4(),
      up: new THREE.Vector3(0, 1, 0),
      bank: new THREE.Matrix4(),
    }),
    [],
  );
  useLayoutEffect(() => {
    flock.forEach((book, index) => {
      coverLeft.current?.setColorAt(index, book.color);
      coverRight.current?.setColorAt(index, book.color);
    });
  }, [flock]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { body, wing, hinge, at, ahead, look, up, bank } = scratch;
    flock.forEach((book, index) => {
      const angle = book.offset + t * book.loop.speed;
      const direction = Math.sign(book.loop.speed);
      pointOnLoop(book.loop, angle, at);
      at.y += book.lift + Math.sin(t * BOB.rate + book.phase) * BOB.height;
      pointOnLoop(book.loop, angle + direction * 0.05, ahead);
      ahead.y = at.y;
      look.lookAt(ahead, at, up);
      bank.makeRotationZ(direction * BANK);
      body.copy(look).multiply(bank).setPosition(at);
      const flap = FLAP.open + Math.sin(t * FLAP.rate + book.phase) * FLAP.swing;
      coverLeft.current?.setMatrixAt(index, wing.multiplyMatrices(body, hinge.makeRotationZ(flap)));
      pagesLeft.current?.setMatrixAt(index, wing);
      coverRight.current?.setMatrixAt(index, wing.multiplyMatrices(body, hinge.makeRotationZ(-flap)));
      pagesRight.current?.setMatrixAt(index, wing);
    });
    for (const mesh of [coverLeft.current, coverRight.current, pagesLeft.current, pagesRight.current]) {
      if (mesh) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  });
  return (
    <group>
      <instancedMesh ref={coverLeft} args={[halves.coverLeft, coverLook, flock.length]} frustumCulled={false} />
      <instancedMesh ref={coverRight} args={[halves.coverRight, coverLook, flock.length]} frustumCulled={false} />
      <instancedMesh ref={pagesLeft} args={[halves.pagesLeft, pageLook, flock.length]} frustumCulled={false} />
      <instancedMesh ref={pagesRight} args={[halves.pagesRight, pageLook, flock.length]} frustumCulled={false} />
      <points geometry={sparks} material={trail} frustumCulled={false} />
    </group>
  );
}
