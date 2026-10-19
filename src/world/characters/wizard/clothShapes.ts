import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// A garment outline as [radius, y] pairs, listed top down.
export type Profile = readonly (readonly [number, number])[];

export function radiusAt(profile: Profile, y: number) {
  const first = profile[0];
  const last = profile[profile.length - 1];
  if (!first || !last) {
    return 0;
  }
  if (y >= first[1]) {
    return first[0];
  }
  for (let index = 1; index < profile.length; index++) {
    const upper = profile[index - 1];
    const lower = profile[index];
    if (upper && lower && y >= lower[1]) {
      return THREE.MathUtils.lerp(upper[0], lower[0], (upper[1] - y) / (upper[1] - lower[1]));
    }
  }
  return last[0];
}

export type Surface = {
  profile: Profile;
  top: number;
  bottom: number;
  // Angular extent at each height; φ = 0 faces forward (+z) and grows toward +x.
  span: (y: number) => readonly [number, number];
  rows: number;
  columns: number;
  // Radial offset from the profile, e.g. folds; layers built from the same function lie on the same folds.
  displace?: (phi: number, y: number) => number;
  // Distance outside the folded surface, for a layer worn on top of it.
  offset?: number;
  // Front-to-back squash at each height (1 is round).
  depth?: (y: number) => number;
  // Raises or lowers the surface around the turn, e.g. a belt slung lower at the front.
  slant?: (phi: number) => number;
  // Brightness baked into vertex colours: fold valleys, worn hems and cloth tucked under a belt read darker.
  shade?: (phi: number, y: number) => number;
  uv?: (phi: number, y: number, radius: number) => readonly [number, number];
};

export function surfacePoint(surface: Surface, phi: number, level: number, target = new THREE.Vector3()) {
  const y = level + (surface.slant?.(phi) ?? 0);
  const radius = radiusAt(surface.profile, y) + (surface.displace?.(phi, y) ?? 0);
  const offset = surface.offset ?? 0;
  const depth = surface.depth?.(y) ?? 1;
  return target.set((radius + offset) * Math.sin(phi), y, (radius * depth + offset) * Math.cos(phi));
}

export function revolve(surface: Surface) {
  const { rows, columns, top, bottom } = surface;
  const count = (rows + 1) * (columns + 1);
  const position = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const point = new THREE.Vector3();
  for (let row = 0; row <= rows; row++) {
    const y = THREE.MathUtils.lerp(top, bottom, row / rows);
    const [from, to] = surface.span(y);
    for (let column = 0; column <= columns; column++) {
      const phi = THREE.MathUtils.lerp(from, to, column / columns);
      const index = row * (columns + 1) + column;
      surfacePoint(surface, phi, y, point).toArray(position, index * 3);
      color.fill(surface.shade?.(phi, y) ?? 1, index * 3, index * 3 + 3);
      const [u, v] = surface.uv?.(phi, y, radiusAt(surface.profile, y)) ?? [phi / (Math.PI * 2), (y - bottom) / (top - bottom)];
      uv[index * 2] = u;
      uv[index * 2 + 1] = v;
    }
  }
  const index: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  if (isFullTurn(surface)) {
    weldSeamNormals(geometry, rows, columns);
  }
  return geometry;
}

function isFullTurn(surface: Surface) {
  const [from, to] = surface.span(surface.top);
  return Math.abs(to - from - Math.PI * 2) < 1e-6;
}

// The first and last columns of a full turn are the same seam; averaging their normals hides it.
function weldSeamNormals(geometry: THREE.BufferGeometry, rows: number, columns: number) {
  const normal = geometry.getAttribute("normal");
  const sum = new THREE.Vector3();
  for (let row = 0; row <= rows; row++) {
    const first = row * (columns + 1);
    const last = first + columns;
    sum.set(normal.getX(first) + normal.getX(last), normal.getY(first) + normal.getY(last), normal.getZ(first) + normal.getZ(last)).normalize();
    normal.setXYZ(first, sum.x, sum.y, sum.z);
    normal.setXYZ(last, sum.x, sum.y, sum.z);
  }
}

// Index and buffers for a tube of `rings` cross-sections with `sides` facets; writeTube fills in its shape.
export function tubeGeometry(rings: number, sides: number, closed: boolean) {
  const index: number[] = [];
  const segments = closed ? rings : rings - 1;
  for (let ring = 0; ring < segments; ring++) {
    const next = (ring + 1) % rings;
    for (let side = 0; side < sides; side++) {
      const a = ring * (sides + 1) + side;
      const b = next * (sides + 1) + side;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const vertices = rings * (sides + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices * 3), 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(vertices * 3), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(vertices * 2), 2));
  geometry.setIndex(index);
  return geometry;
}

const tubeScratch = { tangent: new THREE.Vector3(), outward: new THREE.Vector3(), across: new THREE.Vector3(), direction: new THREE.Vector3() };

// Sweeps a circle along `points`. `reference(ring)` gives the direction one side of the tube faces, e.g. out of the
// cloth it edges; by default it points away from the garment's centre line, so rolls sit flat against the cloth.
export function writeTube(
  geometry: THREE.BufferGeometry,
  points: readonly THREE.Vector3[],
  radius: number,
  sides: number,
  closed: boolean,
  reference?: (ring: number, target: THREE.Vector3) => THREE.Vector3,
) {
  const { tangent, outward, across, direction } = tubeScratch;
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  const rings = points.length;
  let travelled = 0;
  points.forEach((point, ring) => {
    const before = points[closed ? (ring - 1 + rings) % rings : Math.max(ring - 1, 0)] ?? point;
    const after = points[closed ? (ring + 1) % rings : Math.min(ring + 1, rings - 1)] ?? point;
    tangent.subVectors(after, before).normalize();
    if (reference) {
      reference(ring, outward);
    } else {
      outward.set(point.x, 0, point.z);
    }
    outward.addScaledVector(tangent, -outward.dot(tangent)).normalize();
    across.crossVectors(tangent, outward);
    travelled += ring > 0 ? point.distanceTo(points[ring - 1] ?? point) : 0;
    for (let side = 0; side <= sides; side++) {
      const angle = (side / sides) * Math.PI * 2;
      direction.copy(outward).multiplyScalar(Math.cos(angle)).addScaledVector(across, Math.sin(angle));
      const index = ring * (sides + 1) + side;
      normal.setXYZ(index, direction.x, direction.y, direction.z);
      position.setXYZ(index, point.x + direction.x * radius, point.y + direction.y * radius, point.z + direction.z * radius);
      uv.setXY(index, travelled / (radius * Math.PI * 2), side / sides);
    }
  });
  position.needsUpdate = true;
  normal.needsUpdate = true;
  return geometry;
}

// A tube swept along `points`; used for rolled hems, piping and cords.
export function tube(points: readonly THREE.Vector3[], radius: number, sides: number, closed: boolean) {
  return writeTube(tubeGeometry(points.length, sides, closed), points, radius, sides, closed);
}

// Points along the edge of a surface: a ring at one height, or a line down one side.
export function ringPoints(surface: Surface, y: number, steps: number) {
  const [from, to] = surface.span(y);
  const full = Math.abs(to - from - Math.PI * 2) < 1e-6;
  return Array.from({ length: full ? steps : steps + 1 }, (_, step) => surfacePoint(surface, THREE.MathUtils.lerp(from, to, step / steps), y));
}

export function edgePoints(surface: Surface, side: 0 | 1, steps: number) {
  return Array.from({ length: steps + 1 }, (_, step) => {
    const y = THREE.MathUtils.lerp(surface.top, surface.bottom, step / steps);
    return surfacePoint(surface, surface.span(y)[side], y);
  });
}

// Uniform vertex colour, so pieces without baked shading can share a shaded material.
export function evenShade(geometry: THREE.BufferGeometry, brightness = 1) {
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3).fill(brightness), 3));
  return geometry;
}

// Weights each vertex to the two nearest bones of a vertical chain (rest heights listed top down).
export function skinByHeight(geometry: THREE.BufferGeometry, boneHeights: readonly number[]) {
  const position = geometry.getAttribute("position");
  const skinIndex = new Uint16Array(position.count * 4);
  const skinWeight = new Float32Array(position.count * 4);
  for (let vertex = 0; vertex < position.count; vertex++) {
    const y = position.getY(vertex);
    let upper = 0;
    while (upper < boneHeights.length - 2 && y < (boneHeights[upper + 1] ?? y)) {
      upper++;
    }
    const from = boneHeights[upper] ?? 0;
    const to = boneHeights[upper + 1] ?? from;
    const lower = to < from ? THREE.MathUtils.smoothstep(from - y, 0, from - to) : 0;
    skinIndex[vertex * 4] = upper;
    skinIndex[vertex * 4 + 1] = Math.min(upper + 1, boneHeights.length - 1);
    skinWeight[vertex * 4] = 1 - lower;
    skinWeight[vertex * 4 + 1] = lower;
  }
  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight, 4));
  return geometry;
}

// Merges parts built by different generators: indexed and unindexed pieces mix, and vertex colours are kept
// only when every part has them.
export function mergeParts(parts: readonly THREE.BufferGeometry[]) {
  const indexed = parts.every((part) => part.index !== null);
  const coloured = parts.every((part) => part.hasAttribute("color"));
  const ready = parts.map((part) => {
    const copy = indexed || part.index === null ? part.clone() : part.toNonIndexed();
    if (!coloured) {
      copy.deleteAttribute("color");
    }
    return copy;
  });
  return mergeGeometries(ready);
}

// UVs that keep the robe's motif the same size on narrow sleeves as on the skirt; the robe texture tiles 3 by 2.
export function clothUv(tile: number) {
  return (phi: number, y: number, radius: number) => [(phi * radius) / (tile * 3), y / (tile * 2)] as const;
}

// Position and orientation on a surface: +z out of the cloth, +y up along it. For seating clasps and buttons.
export function surfaceFrame(surface: Surface, phi: number, y: number) {
  const at = surfacePoint(surface, phi, y);
  const up = surfacePoint(surface, phi, y + 0.01)
    .sub(at)
    .normalize();
  const around = surfacePoint(surface, phi + 0.01, y)
    .sub(at)
    .normalize();
  const out = new THREE.Vector3().crossVectors(around, up).normalize();
  const side = new THREE.Vector3().crossVectors(up, out);
  return { at, rotation: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, out)) };
}

// A ribbon of the given width lying on a surface along a path of (φ, y), e.g. a strap worn across the chest.
export function pathStrip(surface: Surface, path: (along: number) => readonly [number, number], width: number, steps: number) {
  const centres = Array.from({ length: steps + 1 }, (_, step) => {
    const [phi, y] = path(step / steps);
    return surfacePoint(surface, phi, y);
  });
  const position: number[] = [];
  const uv: number[] = [];
  const tangent = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const side = new THREE.Vector3();
  let travelled = 0;
  centres.forEach((centre, step) => {
    tangent.subVectors(centres[Math.min(step + 1, steps)] ?? centre, centres[Math.max(step - 1, 0)] ?? centre).normalize();
    outward.set(centre.x, 0, centre.z).normalize();
    side
      .crossVectors(outward, tangent)
      .normalize()
      .multiplyScalar(width / 2);
    travelled += step > 0 ? centre.distanceTo(centres[step - 1] ?? centre) : 0;
    position.push(centre.x - side.x, centre.y - side.y, centre.z - side.z, centre.x + side.x, centre.y + side.y, centre.z + side.z);
    uv.push(travelled / width, 0, travelled / width, 1);
  });
  const index: number[] = [];
  for (let step = 0; step < steps; step++) {
    const a = step * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
