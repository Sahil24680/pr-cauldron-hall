import * as THREE from "three";
import { evenShade, mergeParts, tube } from "./clothShapes";
import { NearOnly } from "./detail";
import { lathe, shadeByHeight } from "./geometry";
import type { WizardLook } from "./look";
import { HAT_STRETCH } from "./proportions";

// Authored on the 0.23 m model head (see WizardBody's FACE_SCALE). High enough on the skull that the brim clears the brows.
const HAT_SEAT_Y = 0.2;
const HAT_TILT = new THREE.Euler(-0.1, 0, 0.04);
const BRIM = { rim: 0.535, droop: -0.11, wave: 0.028, waves: 3, roll: 0.012 };
const BAND = { radius: 0.244, height: 0.08, y: 0.06 };
// The crown is three stacked sections, each bent further back and to the side, so the hat stays tall and crooked.
const CROWN = [
  { at: [0, 0, 0], bend: [0, 0, 0], shape: new THREE.CylinderGeometry(0.15, 0.24, 0.34, 32, 6, true).translate(0, 0.19, 0), crease: 0 },
  { at: [0, 0.34, 0], bend: [-0.3, 0, 0.12], shape: new THREE.CylinderGeometry(0.08, 0.15, 0.3, 28, 6, true).translate(0, 0.14, 0), crease: 0.15 },
  { at: [0, 0.28, 0], bend: [-0.45, 0, 0.2], shape: new THREE.ConeGeometry(0.08, 0.3, 24, 4).translate(0, 0.14, 0), crease: 0.08 },
] as const;
const CREASE_SHADE = 0.72;
const TIP_STAR_Y = 0.3;

// A soft brim that rises and dips around the head, its edge rolled over.
function brimShell() {
  const brim = lathe(
    [
      [0.01, 0.02],
      [0.24, 0.02],
      [0.46, -0.03],
      [BRIM.rim, BRIM.droop + 0.01],
      [BRIM.rim - 0.005, BRIM.droop],
    ],
    64,
  );
  const position = brim.getAttribute("position");
  const wave = (x: number, z: number) => BRIM.wave * (Math.hypot(x, z) / BRIM.rim) ** 2 * Math.cos(BRIM.waves * Math.atan2(x, z) + 0.5);
  for (let index = 0; index < position.count; index++) {
    position.setY(index, position.getY(index) + wave(position.getX(index), position.getZ(index)));
  }
  brim.computeVertexNormals();
  const rim = Array.from({ length: 64 }, (_, step) => {
    const angle = (step / 64) * Math.PI * 2;
    const x = Math.sin(angle) * BRIM.rim;
    const z = Math.cos(angle) * BRIM.rim;
    return new THREE.Vector3(x, BRIM.droop + 0.008 + wave(x, z), z);
  });
  const shadedBrim = shadeByHeight(brim, (y) => THREE.MathUtils.lerp(0.78, 1, THREE.MathUtils.smoothstep(-y, -0.02, 0.04)));
  return { brim: shadedBrim, roll: evenShade(tube(rim, BRIM.roll, 6, true)) };
}

// Bakes the bent crown sections (and a soft crease ring where each meets the last) into the hat's own space.
function crownShell() {
  const stretch = new THREE.Matrix4().makeScale(1, HAT_STRETCH, 1);
  let frame = stretch.clone();
  const pieces: THREE.BufferGeometry[] = [];
  let tip = new THREE.Matrix4();
  for (const { at, bend, shape, crease } of CROWN) {
    frame = frame
      .clone()
      .multiply(
        new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...bend)), new THREE.Vector3(1, 1, 1)),
      );
    const nearBand = (y: number) => THREE.MathUtils.lerp(0.8, 1, THREE.MathUtils.smoothstep(y, 0.02, 0.16));
    pieces.push(shadeByHeight(shape.clone(), crease === 0 ? nearBand : () => 1).applyMatrix4(frame));
    if (crease > 0) {
      pieces.push(evenShade(new THREE.TorusGeometry(crease, crease * 0.12, 6, 28).rotateX(Math.PI / 2), CREASE_SHADE).applyMatrix4(frame));
    }
    tip = frame;
  }
  const star = new THREE.OctahedronGeometry(0.045)
    .scale(1, 1 / HAT_STRETCH, 1)
    .rotateX(Math.PI / 2)
    .translate(0, TIP_STAR_Y, 0);
  return { crown: mergeParts(pieces), star: star.applyMatrix4(tip) };
}

const brimParts = brimShell();
const crownParts = crownShell();
const shell = mergeParts([brimParts.brim, brimParts.roll, crownParts.crown]);
const band = new THREE.CylinderGeometry(BAND.radius - 0.006, BAND.radius + 0.006, BAND.height, 40, 1, true).translate(0, BAND.y, 0);
const bandPiping = mergeParts(
  [BAND.y - BAND.height / 2, BAND.y + BAND.height / 2].map((y, index) =>
    new THREE.TorusGeometry(BAND.radius + (index === 0 ? 0.007 : -0.005), 0.007, 6, 40).rotateX(Math.PI / 2).translate(0, y, 0),
  ),
);
const buckle = new THREE.TorusGeometry(0.04, 0.009, 4, 4)
  .rotateZ(Math.PI / 4)
  .scale(1, 0.85, 1)
  .translate(0, BAND.y, BAND.radius + 0.012);

// The hat shares the robe's velvet and motif, wears an embroidered band, and shows its lining under the brim.
export function Hat({ look }: { look: WizardLook }) {
  return (
    <group position={[0, HAT_SEAT_Y, 0]} rotation={HAT_TILT}>
      <mesh geometry={shell} material={look.hat} />
      <mesh geometry={brimParts.brim} material={look.liningInside} />
      <mesh geometry={band} material={look.trim} />
      <mesh geometry={bandPiping} material={look.gold} />
      <mesh geometry={crownParts.star} material={look.gold} />
      <NearOnly>
        <mesh geometry={buckle} material={look.gold} />
      </NearOnly>
    </group>
  );
}
