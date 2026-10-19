import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { type BillboardSize, Billboards } from "./Billboards";
import { books, instancedBooks } from "./bookMaterial";
import type { Duster, FloatingBook, SlidingBook } from "./bookcaseParts";
import { merged, placed } from "./geometryKit";
import { billboardQuad, createGlowMaterial } from "./glowShaders";
import { createDriftGeometry, createDriftMaterial } from "./particles";

const FLOAT_BOB = 0.06;
const FLOAT_BOB_RATE = 1.1;
const FLOAT_SPIN = 0.25;
const FLOAT_TILT = 0.12;
const FLOATER_GLOW_SIZES: BillboardSize[] = [[0.9, 0.9]];
const FLOATER_SPARKLES = 14;
const SLIDE_PERIOD = 11;
const SLIDE_HOLD = 0.35;
const SLIDE_ACTIVE_SHARE = 0.4;
const DUSTER_SWEEP = 0.9;
const DUSTER_RATE = 0.35;
const DUSTER_FLICK_RATE = 9;
const DUSTER_FLICK = 0.35;
const DUST_PUFFS = 24;

const floaterGlow = createGlowMaterial({ color: "#ffd98a", intensity: 0.35, pulse: 0.2 });
const floaterSparkles = createDriftMaterial({
  color: "#ffe6a8",
  colorEnd: "#b9a0ff",
  velocity: [0, 0.12, 0],
  wander: 0.18,
  life: 3,
  size: 0.025,
  opacity: 1,
  twinkle: 0.7,
  shape: "star",
  additive: true,
});
const dustPuffs = createDriftMaterial({
  color: "#d9cbb0",
  velocity: [0, -0.04, 0],
  wander: 0.12,
  life: 2.6,
  size: 0.04,
  sizeEnd: 0.2,
  opacity: 0.1,
  twinkle: 0,
  shape: "soft",
  additive: false,
});
const dusterLook = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });

function buildDuster() {
  const handle = new THREE.CylinderGeometry(0.012, 0.016, 0.34, 8).translate(0, -0.17, 0);
  const cap = new THREE.CylinderGeometry(0.02, 0.016, 0.03, 8);
  const plume = new THREE.ConeGeometry(0.07, 0.2, 7).rotateX(Math.PI).translate(0, 0.08, 0);
  const pieces = [placed(handle, new THREE.Matrix4(), "#4a2a16"), placed(cap, new THREE.Matrix4(), "#c79a3b")];
  for (let feather = 0; feather < 5; feather++) {
    const angle = (feather / 5) * Math.PI * 2;
    const tuft = new THREE.Matrix4().compose(
      new THREE.Vector3(Math.cos(angle) * 0.025, 0.02, Math.sin(angle) * 0.025),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(angle) * 0.35, 0, -Math.cos(angle) * 0.35)),
      new THREE.Vector3(0.7, 1, 0.7),
    );
    pieces.push(placed(plume, tuft, feather % 2 === 0 ? "#b9a68a" : "#8a7560"));
  }
  return merged(pieces);
}

const dusterShape = buildDuster();

function FloatingBooks({ list }: { list: FloatingBook[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => instancedBooks(list), [list]);
  const glowAt = useMemo(() => list.map((book) => book.at), [list]);
  const sparkles = useMemo(
    () =>
      createDriftGeometry(list.length * FLOATER_SPARKLES, 7, (random, index) => {
        const book = list[Math.floor(index / FLOATER_SPARKLES)];
        return [(book?.at.x ?? 0) + (random() - 0.5) * 0.3, (book?.at.y ?? 0) - 0.25 + random() * 0.2, (book?.at.z ?? 0) + (random() - 0.5) * 0.3];
      }),
    [list],
  );
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const turn = useMemo(() => new THREE.Quaternion(), []);
  const lifted = useMemo(() => new THREE.Vector3(), []);
  useLayoutEffect(() => {
    list.forEach((book, index) => {
      mesh.current?.setColorAt(index, book.color);
    });
  }, [list]);
  useFrame((state) => {
    const instances = mesh.current;
    if (!instances) {
      return;
    }
    const t = state.clock.elapsedTime;
    list.forEach((book, index) => {
      const phase = index * 2.3;
      lifted.copy(book.at).setY(book.at.y + Math.sin(t * FLOAT_BOB_RATE + phase) * FLOAT_BOB);
      turn.setFromEuler(
        new THREE.Euler(Math.sin(t * 0.7 + phase) * FLOAT_TILT, book.turn + Math.sin(t * FLOAT_SPIN + phase) * 0.6, Math.sin(t * 0.9 + phase) * FLOAT_TILT),
      );
      instances.setMatrixAt(index, matrix.compose(lifted, turn, book.size));
    });
    instances.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={mesh} args={[geometry, books, list.length]} frustumCulled={false} />
      <Billboards at={glowAt} sizes={FLOATER_GLOW_SIZES} geometry={billboardQuad} material={floaterGlow} />
      <points geometry={sparkles} material={floaterSparkles} frustumCulled={false} />
    </group>
  );
}

// A book on each case slips out, waits, and tucks itself back in, as if an unseen librarian were tidying.
function SlidingBooks({ list }: { list: SlidingBook[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => instancedBooks(list), [list]);
  const scratch = useMemo(() => ({ matrix: new THREE.Matrix4(), shift: new THREE.Matrix4() }), []);
  useLayoutEffect(() => {
    list.forEach((book, index) => {
      mesh.current?.setColorAt(index, book.color);
    });
  }, [list]);
  useFrame((state) => {
    const instances = mesh.current;
    if (!instances) {
      return;
    }
    list.forEach((book, index) => {
      const cycle = ((state.clock.elapsedTime + book.phase) % SLIDE_PERIOD) / SLIDE_PERIOD;
      const active = Math.min(1, cycle / SLIDE_ACTIVE_SHARE);
      const reach = THREE.MathUtils.smootherstep(Math.min(1, Math.sin(active * Math.PI) / (1 - SLIDE_HOLD)), 0, 1);
      scratch.shift.makeTranslation(book.out.x * reach, book.out.y * reach, book.out.z * reach);
      instances.setMatrixAt(index, scratch.matrix.multiplyMatrices(scratch.shift, book.matrix));
    });
    instances.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geometry, books, list.length]} frustumCulled={false} />;
}

function Dusters({ list }: { list: Duster[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const puffs = useMemo(
    () =>
      createDriftGeometry(list.length * DUST_PUFFS, 19, (random, index) => {
        const duster = list[Math.floor(index / DUST_PUFFS)];
        const along = (random() * 2 - 1) * DUSTER_SWEEP;
        const at = duster ? duster.centre.clone().addScaledVector(duster.along, along) : new THREE.Vector3();
        return [at.x, at.y - 0.12, at.z];
      }),
    [list],
  );
  const scratch = useMemo(
    () => ({ matrix: new THREE.Matrix4(), turn: new THREE.Quaternion(), tilt: new THREE.Euler(), at: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1) }),
    [],
  );
  useFrame((state) => {
    const instances = mesh.current;
    if (!instances) {
      return;
    }
    const t = state.clock.elapsedTime;
    list.forEach((duster, index) => {
      const sweep = Math.sin(t * DUSTER_RATE + duster.phase);
      scratch.at.copy(duster.centre).addScaledVector(duster.along, sweep * DUSTER_SWEEP);
      scratch.at.y += Math.abs(Math.sin(t * DUSTER_FLICK_RATE * 0.5 + duster.phase)) * 0.03;
      scratch.tilt.set(0.5 + Math.sin(t * DUSTER_FLICK_RATE + duster.phase) * DUSTER_FLICK, duster.yaw, Math.cos(t * DUSTER_RATE + duster.phase) * 0.4);
      instances.setMatrixAt(index, scratch.matrix.compose(scratch.at, scratch.turn.setFromEuler(scratch.tilt), scratch.one));
    });
    instances.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={mesh} args={[dusterShape, dusterLook, list.length]} frustumCulled={false} />
      <points geometry={puffs} material={dustPuffs} frustumCulled={false} />
    </group>
  );
}

export function ShelfCharms({ floating, sliding, dusters }: { floating: FloatingBook[]; sliding: SlidingBook[]; dusters: Duster[] }) {
  return (
    <group>
      <FloatingBooks list={floating} />
      <SlidingBooks list={sliding} />
      <Dusters list={dusters} />
    </group>
  );
}
