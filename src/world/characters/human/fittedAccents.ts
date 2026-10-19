import * as THREE from "three";
import { tube } from "../wizard/clothShapes";
import type { Outfit } from "../wizard/look";
import type { BodyLandmarks } from "./landmarks";
import { type Region, dominantRegions } from "./shell";
import { buildSkirt } from "./skirt";

// Accessories fitted to the body mesh (bind pose, model metres, +Z forward, +X to the wearer's left) and skinned like
// the garments. They are fitted to the outermost layer: the tunic 16 mm off the skin and the cape yoke 10 mm off the
// tunic (garments.ts), the skirt raised to match. The sash is worn under a cape, so it sinks back to the tunic.
const TUNIC = 0.016;
const YOKE_LIFT = 0.01;
const CELL = 0.01;
const SKIN_CELL = 0.03;
const SKIN_BLEND = { count: 6, maxRings: 4, softening: 0.005 };

// A baldric over the left shoulder to the right hip. It lies in a plane through both and follows the clothes, bridging
// hollows narrower than `bridge` of a turn (the cleavage, the small of the back) as a band pulled over them would.
const SASH = {
  tilt: 0.51,
  hipSide: 0.2,
  centreRise: 0.5,
  width: 0.06,
  thickness: 0.006,
  gap: 0.002,
  bins: 160,
  bridge: 12,
  spacing: 0.01,
  repeatMetres: 0.12,
};
const COLLAR = { clearance: 0.03, depthRatio: 0.8, height: { back: 0.075, front: 0.045 }, flare: 0.03, frontOpening: 2.1, piping: 0.006, columns: 40, rows: 6 };
const HOOD = {
  reach: 0.07,
  depthRatio: 0.55,
  frontOpening: 1.5,
  roll: { front: 0.018, back: 0.034 },
  rollEnds: 0.08,
  rollSteps: 36,
  pouch: { spread: 1.1, length: 0.22, bulge: 0.06, swellEnds: 0.7, leavesRoll: 0.33, folds: 3, foldDepth: 0.45, columns: 24, rows: 12 },
};

// Helpers

type Point2 = readonly [number, number];
type Triangle = readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3];
type Influence = { at: THREE.Vector3; joints: number[]; weights: number[] };

// The outline of a cross-section around its centre: the farthest point in each direction, with hollows up to
// `bridge` bins wide filled in and the corners that leaves rounded off, never inside the section.
export function sectionOutline(section: readonly Point2[], bins: number, bridge: number) {
  const reach: (number | undefined)[] = new Array(bins).fill(undefined);
  for (const [u, v] of section) {
    const bin = Math.floor(((Math.atan2(v, u) / (Math.PI * 2) + 1) % 1) * bins) % bins;
    reach[bin] = Math.max(reach[bin] ?? 0, Math.hypot(u, v));
  }
  const known = reach.flatMap((value, bin) => (value === undefined ? [] : [bin]));
  const filled = reach.map((value, bin) => {
    if (value !== undefined || known.length === 0) {
      return value ?? 0;
    }
    const after = known.find((candidate) => candidate > bin) ?? (known[0] ?? 0) + bins;
    const before = [...known].reverse().find((candidate) => candidate < bin) ?? (known[known.length - 1] ?? 0) - bins;
    const share = (bin - before) / (after - before);
    return THREE.MathUtils.lerp(reach[(before + bins) % bins] ?? 0, reach[after % bins] ?? 0, share);
  });
  const sweep = (values: number[], pick: (...candidates: number[]) => number) =>
    values.map((_, bin) => pick(...Array.from({ length: bridge * 2 + 1 }, (__, step) => values[(bin + step - bridge + bins) % bins] ?? 0)));
  const bridged = sweep(sweep(filled, Math.max), Math.min);
  const rounding = Math.ceil(bridge / 2);
  const rounded = bridged.map((radius, bin) => {
    let sum = 0;
    for (let step = -rounding; step <= rounding; step++) {
      sum += bridged[(bin + step + bins) % bins] ?? radius;
    }
    return Math.max(radius, sum / (rounding * 2 + 1));
  });
  return rounded.map((radius, bin): Point2 => {
    const angle = ((bin + 0.5) / bins) * Math.PI * 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}

// Evenly spaced points around a counter-clockwise loop, each pushed `standOff` outward.
export function offsetLoop(loop: readonly Point2[], spacing: number, standOff: number) {
  const edges = loop.map((from, index) => {
    const to = loop[(index + 1) % loop.length] ?? from;
    return { from, to, length: Math.hypot(to[0] - from[0], to[1] - from[1]) };
  });
  const perimeter = edges.reduce((sum, edge) => sum + edge.length, 0);
  const count = Math.max(3, Math.ceil(perimeter / spacing));
  const along: Point2[] = [];
  let edgeIndex = 0;
  let edgeStart = 0;
  for (let step = 0; step < count; step++) {
    const distance = (step / count) * perimeter;
    while (edgeIndex < edges.length - 1 && edgeStart + (edges[edgeIndex]?.length ?? 0) < distance) {
      edgeStart += edges[edgeIndex]?.length ?? 0;
      edgeIndex++;
    }
    const edge = edges[edgeIndex];
    if (edge) {
      const share = edge.length > 0 ? (distance - edgeStart) / edge.length : 0;
      along.push([THREE.MathUtils.lerp(edge.from[0], edge.to[0], share), THREE.MathUtils.lerp(edge.from[1], edge.to[1], share)]);
    }
  }
  return along.map((point, index) => {
    const before = along[(index - 1 + along.length) % along.length] ?? point;
    const after = along[(index + 1) % along.length] ?? point;
    const length = Math.hypot(after[0] - before[0], after[1] - before[1]) || 1;
    const outward: Point2 = [(after[1] - before[1]) / length, -(after[0] - before[0]) / length];
    return { at: [point[0] + outward[0] * standOff, point[1] + outward[1] * standOff] as Point2, outward };
  });
}

// A z-buffer of the triangles seen along one axis: per CELL square of the other two, the nearest surface's depth.
function depthMap(
  triangles: readonly Triangle[],
  flatten: (point: THREE.Vector3) => Point2,
  depth: (point: THREE.Vector3) => number,
  nearer: (a: number, b: number) => number,
) {
  const cells = new Map<string, number>();
  const key = (a: number, b: number) => `${a},${b}`;
  for (const triangle of triangles) {
    const [p0, p1, p2] = triangle.map(flatten);
    const [d0, d1, d2] = triangle.map(depth);
    if (!p0 || !p1 || !p2 || d0 === undefined || d1 === undefined || d2 === undefined) {
      continue;
    }
    const area = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
    if (Math.abs(area) < 1e-12) {
      continue;
    }
    for (let a = Math.floor(Math.min(p0[0], p1[0], p2[0]) / CELL); a <= Math.ceil(Math.max(p0[0], p1[0], p2[0]) / CELL); a++) {
      for (let b = Math.floor(Math.min(p0[1], p1[1], p2[1]) / CELL); b <= Math.ceil(Math.max(p0[1], p1[1], p2[1]) / CELL); b++) {
        const [x, y] = [a * CELL, b * CELL];
        const w1 = ((x - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (y - p0[1])) / area;
        const w2 = ((p1[0] - p0[0]) * (y - p0[1]) - (x - p0[0]) * (p1[1] - p0[1])) / area;
        if (w1 >= 0 && w2 >= 0 && w1 + w2 <= 1) {
          const value = d0 + (d1 - d0) * w1 + (d2 - d0) * w2;
          const existing = cells.get(key(a, b));
          cells.set(key(a, b), existing === undefined ? value : nearer(existing, value));
        }
      }
    }
  }
  return (a: number, b: number) => cells.get(key(Math.round(a / CELL), Math.round(b / CELL)));
}

// Skin weights blended from the clothed points nearest a spot (closer ones count more), so a piece worn over the
// clothes bends with them smoothly instead of in steps from one body vertex to the next.
export function blendedInfluence(influences: readonly Influence[]) {
  const cells = new Map<string, Influence[]>();
  const key = (a: number, b: number, c: number) => `${a},${b},${c}`;
  const cellOf = (point: THREE.Vector3) => [Math.floor(point.x / SKIN_CELL), Math.floor(point.y / SKIN_CELL), Math.floor(point.z / SKIN_CELL)] as const;
  for (const influence of influences) {
    const id = key(...cellOf(influence.at));
    cells.set(id, [...(cells.get(id) ?? []), influence]);
  }
  return (point: THREE.Vector3) => {
    const [a, b, c] = cellOf(point);
    const nearby: Influence[] = [];
    for (let ring = 1; ring <= SKIN_BLEND.maxRings && nearby.length < SKIN_BLEND.count; ring++) {
      nearby.length = 0;
      for (let da = -ring; da <= ring; da++) {
        for (let db = -ring; db <= ring; db++) {
          for (let dc = -ring; dc <= ring; dc++) {
            nearby.push(...(cells.get(key(a + da, b + db, c + dc)) ?? []));
          }
        }
      }
    }
    const nearest = nearby.sort((first, second) => first.at.distanceToSquared(point) - second.at.distanceToSquared(point)).slice(0, SKIN_BLEND.count);
    const totals = new Map<number, number>();
    for (const influence of nearest) {
      const share = 1 / (influence.at.distanceTo(point) + SKIN_BLEND.softening);
      influence.joints.forEach((joint, slot) => {
        totals.set(joint, (totals.get(joint) ?? 0) + (influence.weights[slot] ?? 0) * share);
      });
    }
    const strongest = [...totals].sort((first, second) => second[1] - first[1]).slice(0, 4);
    const sum = strongest.reduce((total, [, weight]) => total + weight, 0) || 1;
    return {
      joints: [0, 1, 2, 3].map((slot) => strongest[slot]?.[0] ?? 0),
      weights: [0, 1, 2, 3].map((slot) => (strongest[slot]?.[1] ?? 0) / sum),
    };
  };
}

function wearable(geometry: THREE.BufferGeometry, influenceAt: (point: THREE.Vector3) => Pick<Influence, "joints" | "weights">) {
  const position = geometry.getAttribute("position");
  const joints = new Uint16Array(position.count * 4);
  const weights = new Float32Array(position.count * 4);
  const point = new THREE.Vector3();
  for (let vertex = 0; vertex < position.count; vertex++) {
    const influence = influenceAt(point.fromBufferAttribute(position, vertex));
    joints.set(influence.joints, vertex * 4);
    weights.set(influence.weights, vertex * 4);
  }
  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(joints, 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(weights, 4));
  return geometry;
}

function influencesOf(geometry: THREE.BufferGeometry, keep: (vertex: number) => boolean, at: (vertex: number) => THREE.Vector3) {
  const skinIndex = geometry.getAttribute("skinIndex");
  const skinWeight = geometry.getAttribute("skinWeight");
  const influences: Influence[] = [];
  for (let vertex = 0; vertex < skinIndex.count; vertex++) {
    if (keep(vertex)) {
      const slots = [0, 1, 2, 3];
      influences.push({
        at: at(vertex),
        joints: slots.map((slot) => skinIndex.getComponent(vertex, slot)),
        weights: slots.map((slot) => skinWeight.getComponent(vertex, slot)),
      });
    }
  }
  return influences;
}

// The clothed torso and skirt as triangles, with lookups for the top of the shoulders and the back at a spot.
function clothedSurface(body: THREE.SkinnedMesh, regions: Region[], outfit: Outfit, landmarks: BodyLandmarks, bulk: number) {
  const triangles: Triangle[] = [];
  const position = body.geometry.getAttribute("position");
  const normal = body.geometry.getAttribute("normal");
  const direction = new THREE.Vector3();
  const clothed = (vertex: number) =>
    new THREE.Vector3().fromBufferAttribute(position, vertex).addScaledVector(direction.fromBufferAttribute(normal, vertex), TUNIC + YOKE_LIFT);
  const bodyIndex = body.geometry.getIndex();
  for (let corner = 0; bodyIndex && corner + 2 < bodyIndex.count; corner += 3) {
    const corners = [bodyIndex.getX(corner), bodyIndex.getX(corner + 1), bodyIndex.getX(corner + 2)] as const;
    if (corners.every((vertex) => regions[vertex] === "torso")) {
      triangles.push([clothed(corners[0]), clothed(corners[1]), clothed(corners[2])]);
    }
  }
  const skirt = buildSkirt(outfit, body.skeleton.bones, landmarks, bulk);
  const skirtPosition = skirt.getAttribute("position");
  const skirtIndex = skirt.getIndex();
  const skirtNormal = skirt.getAttribute("normal");
  const skirtVertex = (vertex: number) =>
    new THREE.Vector3().fromBufferAttribute(skirtPosition, vertex).addScaledVector(direction.fromBufferAttribute(skirtNormal, vertex), YOKE_LIFT);
  const skirtPoint = (corner: number) => skirtVertex(skirtIndex?.getX(corner) ?? corner);
  for (let corner = 0; skirtIndex && corner + 2 < skirtIndex.count; corner += 3) {
    triangles.push([skirtPoint(corner), skirtPoint(corner + 1), skirtPoint(corner + 2)]);
  }
  const influenceAt = blendedInfluence([
    ...influencesOf(body.geometry, (vertex) => regions[vertex] === "torso", clothed),
    ...influencesOf(skirt, () => true, skirtVertex),
  ]);
  skirt.dispose();
  return {
    triangles,
    influenceAt,
    topAt: depthMap(
      triangles,
      (point) => [point.x, point.z],
      (point) => point.y,
      Math.max,
    ),
    backAt: depthMap(
      triangles,
      (point) => [point.x, point.y],
      (point) => point.z,
      Math.min,
    ),
  };
}

// Where the clothes cross a slab `halfWidth` either side of a plane, in the plane's own coordinates.
function sectionThrough(
  triangles: readonly Triangle[],
  origin: THREE.Vector3,
  up: THREE.Vector3,
  forward: THREE.Vector3,
  across: THREE.Vector3,
  halfWidth: number,
) {
  const section: Point2[] = [];
  const offset = new THREE.Vector3();
  const crossing = new THREE.Vector3();
  const flatten = (point: THREE.Vector3) => {
    offset.subVectors(point, origin);
    section.push([offset.dot(up), offset.dot(forward)]);
  };
  const sideOf = (point: THREE.Vector3) => offset.subVectors(point, origin).dot(across);
  for (const triangle of triangles) {
    const sides = triangle.map(sideOf);
    triangle.forEach((point, corner) => {
      if (Math.abs(sides[corner] ?? 0) <= halfWidth) {
        flatten(point);
      }
    });
    for (const level of [-halfWidth, 0, halfWidth]) {
      triangle.forEach((point, corner) => {
        const next = triangle[(corner + 1) % 3] ?? point;
        const from = (sides[corner] ?? 0) - level;
        const to = (sides[(corner + 1) % 3] ?? 0) - level;
        if (from * to < 0) {
          flatten(crossing.lerpVectors(point, next, from / (from - to)));
        }
      });
    }
  }
  return section;
}

type ClothedSurface = ReturnType<typeof clothedSurface>;

// Where the neck rises out of the shoulders: its centre line's depth and its radius. The band sits where the skin is
// weighted to the neck bone, which begins higher on the male model than on the female.
const NECK_BAND = { from: 0.05, to: 0.1 };

function neckOf(body: THREE.SkinnedMesh, regions: Region[], landmarks: BodyLandmarks) {
  const position = body.geometry.getAttribute("position");
  const point = new THREE.Vector3();
  let radius = 0;
  let front = Number.NEGATIVE_INFINITY;
  let back = Number.POSITIVE_INFINITY;
  regions.forEach((region, vertex) => {
    point.fromBufferAttribute(position, vertex);
    if (region === "head" && point.y > landmarks.neckBaseY + NECK_BAND.from && point.y < landmarks.neckBaseY + NECK_BAND.to) {
      radius = Math.max(radius, Math.abs(point.x));
      front = Math.max(front, point.z);
      back = Math.min(back, point.z);
    }
  });
  return { radius, centerZ: (front + back) / 2 };
}

// Looks out and in from `reach` for the top of the shoulders, so a ring sits on the body where the neck or the fall of
// the back leaves nothing at that spot; anything far from the neck's base (the skirt seen through the neck) is skipped.
const SHOULDER_SEARCH = { steps: 10, stride: 0.05, below: 0.12, above: 0.15 };

function onShoulders(surface: ClothedSurface, centerZ: number, angle: number, reach: number, depthRatio: number, neckBaseY: number) {
  const spot = (share: number) => [Math.sin(angle) * reach * share, centerZ + Math.cos(angle) * reach * depthRatio * share] as const;
  for (let step = 0; step <= SHOULDER_SEARCH.steps * 2; step++) {
    const share = 1 + (step % 2 === 0 ? 1 : -1) * Math.ceil(step / 2) * SHOULDER_SEARCH.stride;
    const [x, z] = spot(share);
    const y = surface.topAt(x, z);
    if (y !== undefined && y > neckBaseY - SHOULDER_SEARCH.below && y < neckBaseY + SHOULDER_SEARCH.above) {
      return new THREE.Vector3(x, y, z);
    }
  }
  const [x, z] = spot(1);
  return new THREE.Vector3(x, neckBaseY, z);
}

// A median over five points drops a single lookup that fell through a gap, then averaging rounds off the rest.
function smoothHeights(points: THREE.Vector3[], passes: number) {
  const heightAt = (heights: number[], index: number) => heights[THREE.MathUtils.clamp(index, 0, heights.length - 1)] ?? 0;
  const raw = points.map((point) => point.y);
  points.forEach((point, index) => {
    point.y = [-2, -1, 0, 1, 2].map((step) => heightAt(raw, index + step)).sort((a, b) => a - b)[2] ?? point.y;
  });
  for (let pass = 0; pass < passes; pass++) {
    const heights = points.map((point) => point.y);
    points.forEach((point, index) => {
      point.y = (heightAt(heights, index - 1) + heightAt(heights, index) * 2 + heightAt(heights, index + 1)) / 4;
    });
  }
}

function reverseWinding(corners: number[]) {
  for (let corner = 0; corner + 2 < corners.length; corner += 3) {
    const second = corners[corner + 1] ?? 0;
    corners[corner + 1] = corners[corner + 2] ?? 0;
    corners[corner + 2] = second;
  }
  return corners;
}

// Front faces turn toward +row × +column.
function gridIndex(rows: number, columns: number) {
  const index: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return index;
}

// The cape material shows its lining on front faces (the side a cape turns to the body), so cape cloth seen from
// outside is wound inside out.
function insideOut(geometry: THREE.BufferGeometry) {
  const index = geometry.getIndex();
  if (index) {
    geometry.setIndex(reverseWinding(Array.from(index.array)));
  }
  const normal = geometry.getAttribute("normal");
  for (let vertex = 0; vertex < normal.count; vertex++) {
    normal.setXYZ(vertex, -normal.getX(vertex), -normal.getY(vertex), -normal.getZ(vertex));
  }
  return geometry;
}

// Shapes

function buildSash(surface: ClothedSurface, landmarks: BodyLandmarks) {
  const up = new THREE.Vector3(Math.sin(SASH.tilt), Math.cos(SASH.tilt), 0);
  const forward = new THREE.Vector3(0, 0, 1);
  const across = new THREE.Vector3().crossVectors(up, forward);
  const rise = (landmarks.neckBaseY - landmarks.hipY) * SASH.centreRise;
  const origin = new THREE.Vector3(-SASH.hipSide, landmarks.hipY, 0).addScaledVector(up, rise / Math.cos(SASH.tilt));
  const section = sectionThrough(surface.triangles, origin, up, forward, across, SASH.width / 2);
  const loop = offsetLoop(sectionOutline(section, SASH.bins, SASH.bridge), SASH.spacing, SASH.thickness / 2 + SASH.gap - YOKE_LIFT);
  const corners = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ] as const;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const centre = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const corner = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();
  const rings = loop.length + 1;
  for (let ring = 0; ring < rings; ring++) {
    const sample = loop[ring % loop.length];
    if (!sample) {
      continue;
    }
    centre.copy(origin).addScaledVector(up, sample.at[0]).addScaledVector(forward, sample.at[1]);
    outward.copy(up).multiplyScalar(sample.outward[0]).addScaledVector(forward, sample.outward[1]);
    corners.forEach((first, faceIndex) => {
      const second = corners[(faceIndex + 1) % corners.length] ?? first;
      faceNormal.copy(faceIndex % 2 === 0 ? outward : across).multiplyScalar(faceIndex < 2 ? 1 : -1);
      for (const [cornerSide, cornerFace] of [first, second]) {
        corner
          .copy(centre)
          .addScaledVector(across, (cornerSide * SASH.width) / 2)
          .addScaledVector(outward, (cornerFace * SASH.thickness) / 2);
        positions.push(corner.x, corner.y, corner.z);
        normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
        uvs.push((ring * SASH.spacing) / SASH.repeatMetres, (cornerSide + 1) / 2);
      }
    });
  }
  const index: number[] = [];
  const perRing = corners.length * 2;
  for (let ring = 0; ring < rings - 1; ring++) {
    for (let face = 0; face < corners.length; face++) {
      const a = ring * perRing + face * 2;
      const b = a + perRing;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}

// Open at the front so it clears the chin and a beard; taller at the back and a little oval to hug the neck.
function buildCollar(surface: ClothedSurface, neck: ReturnType<typeof neckOf>, landmarks: BodyLandmarks) {
  const reach = neck.radius + COLLAR.clearance;
  const start = COLLAR.frontOpening / 2;
  const sweep = Math.PI * 2 - COLLAR.frontOpening;
  const angles = Array.from({ length: COLLAR.columns + 1 }, (_, column) => start + (column / COLLAR.columns) * sweep);
  const base = angles.map((angle) => onShoulders(surface, neck.centerZ, angle, reach, COLLAR.depthRatio, landmarks.neckBaseY));
  smoothHeights(base, 3);
  const rows = Array.from({ length: COLLAR.rows + 1 }, (_, row) => {
    const rise = row / COLLAR.rows;
    return base.map((foot, column) => {
      const angle = angles[column] ?? 0;
      const flare = COLLAR.flare * rise * rise;
      const height = THREE.MathUtils.lerp(COLLAR.height.front, COLLAR.height.back, (1 - Math.cos(angle)) / 2);
      return new THREE.Vector3(foot.x + Math.sin(angle) * flare, foot.y + height * rise, foot.z + Math.cos(angle) * flare);
    });
  });
  const sheet = new THREE.BufferGeometry();
  sheet.setFromPoints(rows.flat());
  sheet.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      rows.flatMap((row, at) => row.flatMap((_, column) => [column / COLLAR.columns, at / COLLAR.rows])),
      2,
    ),
  );
  sheet.setIndex(reverseWinding(gridIndex(COLLAR.rows, COLLAR.columns)));
  sheet.computeVertexNormals();
  const rim = rows[COLLAR.rows] ?? base;
  return { sheet, piping: tube(rim, COLLAR.piping, 6, false) };
}

function filledGaps(values: readonly (number | undefined)[]) {
  return values.map((value, at) => {
    for (let distance = 0; value === undefined && distance < values.length; distance++) {
      const found = values[at - distance] ?? values[at + distance];
      if (found !== undefined) {
        return found;
      }
    }
    return value;
  });
}

function swellingTube(points: THREE.Vector3[], radiusAt: (along: number) => number) {
  const geometry = tube(points, 1, 10, false);
  const position = geometry.getAttribute("position");
  const sides = position.count / points.length;
  const vertex = new THREE.Vector3();
  points.forEach((centre, ring) => {
    const radius = radiusAt(ring / (points.length - 1));
    for (let side = 0; side < sides; side++) {
      const index = ring * sides + side;
      vertex.fromBufferAttribute(position, index).sub(centre).multiplyScalar(radius).add(centre);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  });
  return geometry;
}

function buildHood(surface: ClothedSurface, neck: ReturnType<typeof neckOf>, landmarks: BodyLandmarks) {
  const reach = neck.radius + COLLAR.clearance + HOOD.reach;
  const rollRadius = (angle: number) => THREE.MathUtils.lerp(HOOD.roll.front, HOOD.roll.back, (1 - Math.cos(angle)) / 2);
  const rollAt = (angle: number) => {
    const point = onShoulders(surface, neck.centerZ, angle, reach, HOOD.depthRatio, landmarks.neckBaseY);
    point.y += rollRadius(angle);
    return point;
  };
  const start = HOOD.frontOpening / 2;
  const sweep = Math.PI * 2 - HOOD.frontOpening;
  const { rollSteps } = HOOD;
  const roll = Array.from({ length: rollSteps + 1 }, (_, step) => rollAt(start + (step / rollSteps) * sweep));
  smoothHeights(roll, 3);
  const rollGeometry = swellingTube(
    roll,
    (along) => rollRadius(start + along * sweep) * Math.sqrt(Math.min(1, along / HOOD.rollEnds, (1 - along) / HOOD.rollEnds)),
  );

  const { spread, length, bulge, swellEnds, leavesRoll, folds, foldDepth, columns, rows } = HOOD.pouch;
  const positions: number[] = [];
  const uvs: number[] = [];
  const tops = Array.from({ length: columns + 1 }, (_, column) => {
    const along = ((Math.PI + ((column / columns) * 2 - 1) * spread - start) / sweep) * rollSteps;
    const below = roll[Math.floor(along)] ?? new THREE.Vector3();
    return below.clone().lerp(roll[Math.ceil(along)] ?? below, along % 1);
  });
  for (let row = 0; row <= rows; row++) {
    const down = row / rows;
    const narrowing = Math.sqrt(Math.max(0, 1 - down * down));
    const spots = tops.map((top) => ({ top, x: top.x * narrowing, y: THREE.MathUtils.lerp(top.y - HOOD.roll.back, top.y - length, down) }));
    const backs = filledGaps(spots.map(({ x, y }) => surface.backAt(x, y)));
    spots.forEach(({ top, x, y }, column) => {
      const across = (column / columns) * 2 - 1;
      const fold = 1 + foldDepth * Math.cos(across * folds * Math.PI);
      const swell = bulge * Math.sin(Math.PI * Math.min(1, down / swellEnds)) * Math.sqrt(1 - across * across) * fold;
      const back = Math.min(backs[column] ?? top.z, top.z);
      positions.push(x, y, THREE.MathUtils.lerp(top.z, back, Math.min(1, down / leavesRoll)) - swell);
      uvs.push(column / columns, down);
    });
  }
  const pouch = new THREE.BufferGeometry();
  pouch.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  pouch.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  pouch.setIndex(gridIndex(rows, columns));
  pouch.computeVertexNormals();
  return { roll: insideOut(rollGeometry), pouch: insideOut(pouch) };
}

const cache = new Map<string, ReturnType<typeof buildFittedAccents>>();

function buildFittedAccents(body: THREE.SkinnedMesh, outfit: Outfit, landmarks: BodyLandmarks, bulk: number) {
  const regions = dominantRegions(body.geometry, body.skeleton.bones);
  const surface = clothedSurface(body, regions, outfit, landmarks, bulk);
  const neck = neckOf(body, regions, landmarks);
  const worn = (geometry: THREE.BufferGeometry) => wearable(geometry, surface.influenceAt);
  const collar = buildCollar(surface, neck, landmarks);
  const hood = buildHood(surface, neck, landmarks);
  return {
    sash: worn(buildSash(surface, landmarks)),
    collar: { sheet: worn(collar.sheet), piping: worn(collar.piping) },
    hood: { roll: worn(hood.roll), pouch: worn(hood.pouch) },
  };
}

// Bodies of one build and physique share their reshaped geometry, so they share these shapes too.
export function fittedAccentsFor(body: THREE.SkinnedMesh, outfit: Outfit, landmarks: BodyLandmarks, bulk: number) {
  const key = `${body.geometry.uuid}|${outfit}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const built = buildFittedAccents(body, outfit, landmarks, bulk);
  cache.set(key, built);
  return built;
}
