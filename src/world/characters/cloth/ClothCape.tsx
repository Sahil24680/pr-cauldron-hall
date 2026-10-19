import { useFrame } from "@react-three/fiber";
import { type RefObject, useMemo, useRef } from "react";
import * as THREE from "three";
import { tubeGeometry, writeTube } from "../wizard/clothShapes";
import { CAPE_LENGTH as LENGTH, ROBE_PROFILE, CAPE_TOP_Y as TOP_Y, WAIST_Y } from "../wizard/proportions";
import { type CapeBody, capeBodyFor, keepBehind, pushOutOfCapsule, pushOutOfColumn } from "./capeBody";

type Props = { anchor: RefObject<THREE.Object3D | null>; material: THREE.Material; fit?: CapeFit };

const COLUMNS = 15;
const ROWS = 18;
const TOP_WIDTH = 0.4;
const BOTTOM_WIDTH = 0.92;
const STEP_SECONDS = 1 / 120;
const MAX_STEPS_PER_FRAME = 8;
const GRAVITY = -11;
// Heavy lined wool: it settles a little faster than light cloth would.
const AIR_DAMPING = 0.98;
const CONSTRAINT_PASSES = 8;
const BODY_MARGIN = 0.07;
const FLOOR_Y = 0.03;
const TELEPORT_DISTANCE = 1.5;
// Share of the body's own movement each frame that the free cloth is carried along with, as game cloth does with a
// world-velocity scale; without it a quick turn or stop flings the cape out like a flag.
const CARRIED_BY_BODY = 0.6;
// The cape's edge is turned and rolled all the way round, showing a line of the lining.
// The cape is drawn as two faces this far either side of the simulated sheet, so it has real thickness; the rolled
// edge closes the gap between them.
const HALF_THICKNESS = 0.008;
const EDGE = { radius: HALF_THICKNESS + 0.004, sides: 6 };

// Where the cape hangs from and the body outline it drapes over (height, radius from the spine), floor-relative metres;
// with a character's colliders the outline is used only below `skirtTopY`, for the skirt.
export type CapeFit = { topY: number; length: number; profile: [number, number][]; skirtTopY: number };
const DEFAULT_FIT: CapeFit = { topY: TOP_Y, length: LENGTH, profile: ROBE_PROFILE, skirtTopY: WAIST_Y };
// How far past the body's side plane the cape's edges may wrap before being held back.
const FRONT_ALLOWANCE = 0.03;

function robeRadiusAt(profile: [number, number][], y: number) {
  const first = profile[0];
  const last = profile[profile.length - 1];
  if (!first || !last || y <= first[0]) {
    return first?.[1] ?? 0.3;
  }
  if (y >= last[0]) {
    return last[1];
  }
  for (let index = 1; index < profile.length; index++) {
    const upper = profile[index];
    const lower = profile[index - 1];
    if (upper && lower && y <= upper[0]) {
      return THREE.MathUtils.lerp(lower[1], upper[1], (y - lower[0]) / (upper[0] - lower[0]));
    }
  }
  return last[1];
}

function restPoint(fit: CapeFit, column: number, row: number) {
  const down = row / (ROWS - 1);
  const across = column / (COLUMNS - 1) - 0.5;
  const y = fit.topY - down * fit.length;
  const radius = robeRadiusAt(fit.profile, y) + BODY_MARGIN;
  const halfAngle = (THREE.MathUtils.lerp(TOP_WIDTH, BOTTOM_WIDTH, down) / 2 / radius) * 1;
  const angle = across * 2 * Math.min(halfAngle, Math.PI * 0.45);
  return new THREE.Vector3(Math.sin(angle) * radius, y, -Math.cos(angle) * radius);
}

// Vertex indices around the sheet's border: along the top, down one side, back along the hem and up the other side.
function borderLoop() {
  const top = Array.from({ length: COLUMNS }, (_, column) => column);
  const right = Array.from({ length: ROWS - 1 }, (_, row) => (row + 1) * COLUMNS + COLUMNS - 1);
  const bottom = Array.from({ length: COLUMNS - 1 }, (_, column) => (ROWS - 1) * COLUMNS + COLUMNS - 2 - column);
  const left = Array.from({ length: ROWS - 2 }, (_, row) => (ROWS - 2 - row) * COLUMNS);
  return [...top, ...right, ...bottom, ...left];
}

function linksFor(rest: THREE.Vector3[]) {
  const links: { a: number; b: number; length: number }[] = [];
  const link = (a: number, b: number) => {
    const from = rest[a];
    const to = rest[b];
    if (from && to) {
      links.push({ a, b, length: from.distanceTo(to) });
    }
  };
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const index = row * COLUMNS + column;
      if (column < COLUMNS - 1) {
        link(index, index + 1);
      }
      if (row < ROWS - 1) {
        link(index, index + COLUMNS);
      }
      if (column < COLUMNS - 1 && row < ROWS - 1) {
        link(index, index + COLUMNS + 1);
        link(index + 1, index + COLUMNS);
      }
      if (row < ROWS - 2) {
        link(index, index + COLUMNS * 2);
      }
      if (column < COLUMNS - 2) {
        link(index, index + 2);
      }
    }
  }
  return links;
}

// With a character's colliders: slide over the bones' capsules, stay outside the skirt below the waist, and never
// pass in front of the body.
function collideWithBody(point: THREE.Vector3, body: CapeBody, fit: CapeFit, pinsTopY: number) {
  for (const capsule of body.capsules) {
    pushOutOfCapsule(point, capsule);
  }
  const height = point.y - body.floorY;
  if (height < fit.skirtTopY) {
    pushOutOfColumn(point, body.hips, robeRadiusAt(fit.profile, height) + BODY_MARGIN * 0.6);
  }
  keepBehind(point, body.chest, body.forward, FRONT_ALLOWANCE);
  // Never above its own pinned edge: on take-off or a hard landing the cloth would otherwise fold up over the head.
  point.y = Math.min(point.y, pinsTopY);
}

export function ClothCape({ anchor, material, fit = DEFAULT_FIT }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const collider = useRef<CapeBody | null>(null);
  const cloth = useMemo(() => {
    const rest = Array.from({ length: ROWS * COLUMNS }, (_, index) => restPoint(fit, index % COLUMNS, Math.floor(index / COLUMNS)));
    const geometry = new THREE.PlaneGeometry(1, 1, COLUMNS - 1, ROWS - 1);
    const position = rest.map((point) => point.clone());
    const border = borderLoop();
    return {
      rest,
      links: linksFor(rest),
      geometry,
      position,
      border,
      edge: tubeGeometry(border.length, EDGE.sides, true),
      edgePoints: border.map((index) => position[index] ?? new THREE.Vector3()),
      previous: rest.map((point) => point.clone()),
      ready: false,
      leftover: 0,
      lastPin: new THREE.Vector3(),
      lastWorld: new THREE.Matrix4(),
      faces: [geometry.clone(), geometry.clone()] as const,
    };
  }, [fit]);
  const scratch = useMemo(
    () => ({
      world: new THREE.Matrix4(),
      local: new THREE.Matrix4(),
      point: new THREE.Vector3(),
      delta: new THREE.Vector3(),
      moved: new THREE.Matrix4(),
      carried: new THREE.Vector3(),
    }),
    [],
  );

  // Moves every free point part of the way along the body's motion since last frame, keeping its velocity.
  const carryWithBody = (world: THREE.Matrix4) => {
    scratch.moved.copy(cloth.lastWorld).invert().premultiply(world);
    for (let index = COLUMNS; index < cloth.position.length; index++) {
      for (const points of [cloth.position, cloth.previous]) {
        const point = points[index];
        if (point) {
          scratch.carried.copy(point).applyMatrix4(scratch.moved);
          point.lerp(scratch.carried, CARRIED_BY_BODY);
        }
      }
    }
  };

  const resetTo = (world: THREE.Matrix4) => {
    cloth.rest.forEach((point, index) => {
      cloth.position[index]?.copy(point).applyMatrix4(world);
      cloth.previous[index]?.copy(point).applyMatrix4(world);
    });
  };

  // Without a character's colliders: the fitted outline around the pin frame's upright axis.
  const collideWithOutline = (current: THREE.Vector3, world: THREE.Matrix4, local: THREE.Matrix4) => {
    scratch.point.copy(current).applyMatrix4(local);
    const minimum = robeRadiusAt(fit.profile, scratch.point.y) + BODY_MARGIN * 0.6;
    const radial = Math.hypot(scratch.point.x, scratch.point.z);
    let moved = false;
    if (radial < minimum && scratch.point.y > 0) {
      const scale = minimum / (radial || 1e-6);
      scratch.point.x *= scale;
      scratch.point.z = radial < 1e-6 ? -minimum : scratch.point.z * scale;
      moved = true;
    }
    if (scratch.point.z > 0) {
      scratch.point.z = 0;
      moved = true;
    }
    if (moved) {
      current.copy(scratch.point).applyMatrix4(world);
    }
  };

  const simulate = (world: THREE.Matrix4, local: THREE.Matrix4) => {
    const { position, previous, rest, links } = cloth;
    const body = collider.current;
    let pinsTopY = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < COLUMNS; index++) {
      pinsTopY = Math.max(pinsTopY, position[index]?.y ?? pinsTopY);
    }
    for (let index = 0; index < position.length; index++) {
      const current = position[index];
      const before = previous[index];
      const restPosition = rest[index];
      if (!current || !before || !restPosition) {
        continue;
      }
      if (index < COLUMNS) {
        before.copy(current);
        current.copy(restPosition).applyMatrix4(world);
        continue;
      }
      scratch.delta.subVectors(current, before).multiplyScalar(AIR_DAMPING);
      before.copy(current);
      current.add(scratch.delta);
      current.y += GRAVITY * STEP_SECONDS * STEP_SECONDS;
    }
    for (let pass = 0; pass < CONSTRAINT_PASSES; pass++) {
      for (const { a, b, length } of links) {
        const from = position[a];
        const to = position[b];
        if (!from || !to) {
          continue;
        }
        scratch.delta.subVectors(to, from);
        const distance = scratch.delta.length() || 1e-6;
        const correction = (distance - length) / distance;
        const fromPinned = a < COLUMNS;
        const toPinned = b < COLUMNS;
        if (fromPinned && toPinned) {
          continue;
        }
        const share = fromPinned || toPinned ? 1 : 0.5;
        if (!fromPinned) {
          from.addScaledVector(scratch.delta, correction * share);
        }
        if (!toPinned) {
          to.addScaledVector(scratch.delta, -correction * share);
        }
      }
      for (let index = COLUMNS; index < position.length; index++) {
        const current = position[index];
        if (!current) {
          continue;
        }
        if (body?.ready) {
          collideWithBody(current, body, fit, pinsTopY);
        } else {
          collideWithOutline(current, world, local);
        }
        current.y = Math.max(current.y, FLOOR_Y);
      }
    }
  };

  useFrame((_, delta) => {
    const body = anchor.current;
    const cape = mesh.current;
    if (!body || !cape) {
      return;
    }
    body.updateWorldMatrix(true, false);
    scratch.world.copy(body.matrixWorld);
    collider.current = capeBodyFor(body);
    scratch.local.copy(scratch.world).invert();
    const pin = scratch.point.setFromMatrixPosition(scratch.world);
    if (!cloth.ready || pin.distanceTo(cloth.lastPin) > TELEPORT_DISTANCE) {
      resetTo(scratch.world);
      cloth.lastWorld.copy(scratch.world);
      cloth.ready = true;
    }
    carryWithBody(scratch.world);
    cloth.lastWorld.copy(scratch.world);
    cloth.lastPin.copy(scratch.point.setFromMatrixPosition(scratch.world));
    cloth.leftover = Math.min(cloth.leftover + delta, STEP_SECONDS * MAX_STEPS_PER_FRAME);
    while (cloth.leftover >= STEP_SECONDS) {
      simulate(scratch.world, scratch.local);
      cloth.leftover -= STEP_SECONDS;
    }
    const attribute = cloth.geometry.getAttribute("position");
    cloth.position.forEach((point, index) => attribute.setXYZ(index, point.x, point.y, point.z));
    attribute.needsUpdate = true;
    cloth.geometry.computeVertexNormals();
    cloth.geometry.computeBoundingSphere();
    const normal = cloth.geometry.getAttribute("normal");
    cloth.faces.forEach((face, side) => {
      const offset = side === 0 ? HALF_THICKNESS : -HALF_THICKNESS;
      const facePosition = face.getAttribute("position");
      const faceNormal = face.getAttribute("normal");
      cloth.position.forEach((point, index) => {
        facePosition.setXYZ(index, point.x + normal.getX(index) * offset, point.y + normal.getY(index) * offset, point.z + normal.getZ(index) * offset);
        faceNormal.setXYZ(index, normal.getX(index), normal.getY(index), normal.getZ(index));
      });
      facePosition.needsUpdate = true;
      faceNormal.needsUpdate = true;
      face.computeBoundingSphere();
    });
    writeTube(cloth.edge, cloth.edgePoints, EDGE.radius, EDGE.sides, true, (ring, target) => target.fromBufferAttribute(normal, cloth.border[ring] ?? 0));
  });

  return (
    <>
      <mesh ref={mesh} geometry={cloth.faces[0]} material={material} frustumCulled={false} />
      <mesh geometry={cloth.faces[1]} material={material} frustumCulled={false} />
      <mesh geometry={cloth.edge} material={material} frustumCulled={false} />
    </>
  );
}
