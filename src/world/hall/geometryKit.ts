import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Profile = [number, number][];

const TUBE_SEGMENTS_PER_POINT = 4;
const TUBE_SIDES = 6;

export function lathe(profile: Profile, segments: number) {
  return new THREE.LatheGeometry(
    profile.map(([radius, y]) => new THREE.Vector2(radius, y)),
    segments,
  );
}

export function tube(profile: Profile, radius: number) {
  const curve = new THREE.CatmullRomCurve3(profile.map(([x, y]) => new THREE.Vector3(x, y, 0)));
  return new THREE.TubeGeometry(curve, profile.length * TUBE_SEGMENTS_PER_POINT, radius, TUBE_SIDES, false);
}

export function scroll(centerX: number, centerY: number, radius: number, turns: number, startAngle: number): Profile {
  const steps = Math.ceil(turns * 16);
  return Array.from({ length: steps + 1 }, (_, step) => {
    const t = step / steps;
    const angle = startAngle + t * turns * Math.PI * 2;
    const shrink = radius * (1 - t * 0.78);
    return [centerX + Math.cos(angle) * shrink, centerY + Math.sin(angle) * shrink];
  });
}

export function placeAt(x: number, y: number, z: number, scale = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
}

// Merging needs one shape of buffer, so every piece is flattened to non-indexed and optionally painted one vertex colour.
export function placed(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, color?: THREE.ColorRepresentation) {
  const piece = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(matrix);
  if (color !== undefined) {
    const tint = new THREE.Color(color);
    fillAttribute(piece, "color", [tint.r, tint.g, tint.b]);
  }
  return piece;
}

export function fillAttribute(piece: THREE.BufferGeometry, name: string, components: number[]) {
  const count = piece.attributes.position?.count ?? 0;
  const values = new Float32Array(count * components.length);
  for (let offset = 0; offset < values.length; offset += components.length) {
    values.set(components, offset);
  }
  piece.setAttribute(name, new THREE.BufferAttribute(values, components.length));
  return piece;
}

export function radiusAt(profile: Profile, y: number) {
  for (let index = 1; index < profile.length; index++) {
    const [lowRadius, lowY] = profile[index - 1] ?? [0, 0];
    const [highRadius, highY] = profile[index] ?? [0, 0];
    if (y >= lowY && y <= highY && highY > lowY) {
      return THREE.MathUtils.lerp(lowRadius, highRadius, (y - lowY) / (highY - lowY));
    }
  }
  return 0;
}

export function merged(pieces: THREE.BufferGeometry[]) {
  return pieces.length > 0 ? mergeGeometries(pieces) : new THREE.BufferGeometry();
}

// Box faces in BoxGeometry order (+x, -x, +y, -y, +z, -z) and the extents each face's u and v span.
const FACE_SPANS: ["x" | "y" | "z", "x" | "y" | "z"][] = [
  ["z", "y"],
  ["z", "y"],
  ["x", "z"],
  ["x", "z"],
  ["x", "y"],
  ["x", "y"],
];
const VERTICES_PER_FACE = 4;

// A box whose UVs are in metres with the texture's x running along each face's longer side, so wood grain follows the board.
export function woodBlock(width: number, height: number, depth: number) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const uv = geometry.attributes.uv;
  if (!uv) {
    return geometry;
  }
  const size = { x: width, y: height, z: depth };
  FACE_SPANS.forEach(([along, across], face) => {
    const spanU = size[along];
    const spanV = size[across];
    for (let corner = 0; corner < VERTICES_PER_FACE; corner++) {
      const index = face * VERTICES_PER_FACE + corner;
      const u = uv.getX(index);
      const v = uv.getY(index);
      if (spanU >= spanV) {
        uv.setXY(index, u * spanU, v * spanV);
      } else {
        uv.setXY(index, v * spanV, u * spanU);
      }
    }
  });
  return geometry;
}

export function scaleUv(geometry: THREE.BufferGeometry, scaleU: number, scaleV: number) {
  const uv = geometry.attributes.uv;
  if (uv) {
    for (let index = 0; index < uv.count; index++) {
      uv.setXY(index, uv.getX(index) * scaleU, uv.getY(index) * scaleV);
    }
  }
  return geometry;
}

export function nearestTo(values: number[], target: number) {
  return values.reduce((best, value) => (Math.abs(value - target) < Math.abs(best - target) ? value : best), target);
}
