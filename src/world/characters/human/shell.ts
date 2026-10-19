import * as THREE from "three";

// A garment shell is the body mesh's own triangles, relaxed into a cloth line and pushed out along the normals, so it
// keeps the body's skin weights and bends exactly as the animations bend the body.
export type Region = "head" | "hand" | "arm" | "torso" | "leg" | "foot";

const REGION_BY_BONE: [RegExp, Region][] = [
  [/^(Head|neck_01)$/, "head"],
  [/^(hand|index|middle|ring|pinky|thumb)_/, "hand"],
  [/^(upperarm|lowerarm)_/, "arm"],
  [/^(thigh|calf)_/, "leg"],
  [/^(foot|ball)_/, "foot"],
];

// Taubin smoothing: each shrinking pass is followed by a slightly stronger inflating one, which irons out small
// contours (abs, pecs, kneecaps) without shrinking the garment overall.
const RELAX_RATE = 0.6;
const INFLATE_RATE = -0.63;
const WELD_PRECISION = 1e4;
const MAX_GROUPS = 8;
// Fabric patterns repeat once around the body and once per this many metres of height, so motifs stay square.
const FABRIC_METRES_PER_REPEAT = 0.9;

export type Shell = {
  keep: (point: THREE.Vector3, region: Region) => boolean;
  offset: (point: THREE.Vector3, region: Region) => number;
  // Which material group a triangle joins (0 is the main fabric); a triangle takes the highest group of its corners.
  group: (point: THREE.Vector3, region: Region) => number;
  // Laplacian passes that relax the body's contours (breasts, abs, kneecaps) into the line of cloth hanging over them.
  smoothing: number;
  // Each group's triangles get their own copy of shared corners, so a band (a cuff) can map its embroidery its own way.
  uv: (point: THREE.Vector3, region: Region, group: number) => [number, number];
};

// Some fabric materials shade by vertex colour; garments carry plain white so every material renders as authored.
export function paintWhite(geometry: THREE.BufferGeometry) {
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  return geometry;
}

export function regionOf(boneName: string): Region {
  return REGION_BY_BONE.find(([pattern]) => pattern.test(boneName))?.[1] ?? "torso";
}

export function dominantRegions(geometry: THREE.BufferGeometry, bones: THREE.Bone[]) {
  const skinIndex = geometry.getAttribute("skinIndex");
  const skinWeight = geometry.getAttribute("skinWeight");
  const regions: Region[] = [];
  for (let vertex = 0; vertex < skinIndex.count; vertex++) {
    let best = 0;
    let bestWeight = -1;
    for (let slot = 0; slot < 4; slot++) {
      const weight = skinWeight.getComponent(vertex, slot);
      if (weight > bestWeight) {
        bestWeight = weight;
        best = skinIndex.getComponent(vertex, slot);
      }
    }
    regions.push(regionOf(bones[best]?.name ?? ""));
  }
  return regions;
}

export function wrapUv(around: number, height: number): [number, number] {
  return [around / (Math.PI * 2) + 0.5, height / FABRIC_METRES_PER_REPEAT];
}

// The body mesh splits vertices along UV seams; welding by position keeps a shell closed as it is reshaped.
export function weldGroups(positions: ArrayLike<number>) {
  const groupOf = new Int32Array(positions.length / 3);
  const keys = new Map<string, number>();
  for (let at = 0; at < groupOf.length; at++) {
    const key = [0, 1, 2].map((axis) => Math.round((positions[at * 3 + axis] ?? 0) * WELD_PRECISION)).join(",");
    const existing = keys.get(key);
    groupOf[at] = existing ?? keys.size;
    if (existing === undefined) {
      keys.set(key, keys.size);
    }
  }
  return { groupOf, count: keys.size };
}

// Averages each welded vertex's normals so a seam's two copies move together.
export function weldedNormals(normal: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, groupOf: Int32Array) {
  const sums = new Map<number, THREE.Vector3>();
  const direction = new THREE.Vector3();
  groupOf.forEach((id, vertex) => {
    const sum = sums.get(id) ?? new THREE.Vector3();
    sums.set(id, sum.add(direction.fromBufferAttribute(normal, vertex)));
  });
  const normals = new Float32Array(groupOf.length * 3);
  groupOf.forEach((id, vertex) => {
    const sum = sums.get(id);
    direction.copy(sum ?? direction.set(0, 1, 0)).normalize();
    normals.set([direction.x, direction.y, direction.z], vertex * 3);
  });
  return normals;
}

// Relaxes interior vertices toward their neighbours' average; open edges (collar, cuffs, hems) stay where they are.
function relax(positions: Float32Array, triangles: number[], passes: number) {
  const { groupOf, count } = weldGroups(positions);
  const group = (vertex: number) => groupOf[vertex] ?? 0;
  const neighbours = Array.from({ length: count }, () => new Set<number>());
  const edgeUses = new Map<string, number>();
  for (let corner = 0; corner + 2 < triangles.length; corner += 3) {
    const corners = [triangles[corner] ?? 0, triangles[corner + 1] ?? 0, triangles[corner + 2] ?? 0].map(group);
    corners.forEach((from, side) => {
      const to = corners[(side + 1) % 3] ?? from;
      neighbours[from]?.add(to);
      neighbours[to]?.add(from);
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      edgeUses.set(key, (edgeUses.get(key) ?? 0) + 1);
    });
  }
  const pinned = new Uint8Array(count);
  for (const [key, uses] of edgeUses) {
    if (uses === 1) {
      for (const end of key.split(":")) {
        pinned[Number(end)] = 1;
      }
    }
  }
  let current = new Float32Array(count * 3);
  groupOf.forEach((id, vertex) => current.set(positions.subarray(vertex * 3, vertex * 3 + 3), id * 3));
  for (let pass = 0; pass < passes; pass++) {
    const rate = pass % 2 === 0 ? RELAX_RATE : INFLATE_RATE;
    const next = current.slice();
    neighbours.forEach((around, id) => {
      if (pinned[id] || around.size === 0) {
        return;
      }
      for (let axis = 0; axis < 3; axis++) {
        let sum = 0;
        for (const other of around) {
          sum += current[other * 3 + axis] ?? 0;
        }
        const here = current[id * 3 + axis] ?? 0;
        next[id * 3 + axis] = here + (sum / around.size - here) * rate;
      }
    });
    current = next;
  }
  groupOf.forEach((id, vertex) => positions.set(current.subarray(id * 3, id * 3 + 3), vertex * 3));
  return groupOf;
}

// Relaxing pulls convex areas inward; cloth bridges the hollows but never sinks below the skin it hangs over.
function keepOutsideBody(positions: Float32Array, body: Float32Array, normals: Float32Array) {
  for (let at = 0; at < positions.length; at += 3) {
    let inward = 0;
    for (let axis = 0; axis < 3; axis++) {
      inward += ((positions[at + axis] ?? 0) - (body[at + axis] ?? 0)) * (normals[at + axis] ?? 0);
    }
    if (inward < 0) {
      for (let axis = 0; axis < 3; axis++) {
        positions[at + axis] = (positions[at + axis] ?? 0) - inward * (normals[at + axis] ?? 0);
      }
    }
  }
}

export function extractShell(body: THREE.BufferGeometry, regions: Region[], shell: Shell) {
  const position = body.getAttribute("position");
  const normal = body.getAttribute("normal");
  const skinIndex = body.getAttribute("skinIndex");
  const skinWeight = body.getAttribute("skinWeight");
  const index = body.getIndex();
  const corners = index ? Array.from(index.array) : Array.from({ length: position.count }, (_, vertex) => vertex);
  const point = new THREE.Vector3();
  const kept = new Map<number, number>();
  const keptVertices: { vertex: number; group: number }[] = [];
  const groups: number[][] = [];

  const regionAt = (vertex: number) => regions[vertex] ?? "torso";
  const keepVertex = (vertex: number) => shell.keep(point.fromBufferAttribute(position, vertex), regionAt(vertex));
  const groupOfVertex = (vertex: number) => shell.group(point.fromBufferAttribute(position, vertex), regionAt(vertex));
  const remap = (vertex: number, group: number) => {
    const key = vertex * MAX_GROUPS + group;
    const existing = kept.get(key);
    if (existing !== undefined) {
      return existing;
    }
    kept.set(key, keptVertices.length);
    keptVertices.push({ vertex, group });
    return keptVertices.length - 1;
  };

  for (let corner = 0; corner + 2 < corners.length; corner += 3) {
    const triangle = [corners[corner] ?? 0, corners[corner + 1] ?? 0, corners[corner + 2] ?? 0];
    if (!triangle.every(keepVertex)) {
      continue;
    }
    const group = Math.max(...triangle.map(groupOfVertex));
    const target = groups[group] ?? [];
    groups[group] = target;
    target.push(...triangle.map((vertex) => remap(vertex, group)));
  }

  const positions = new Float32Array(keptVertices.length * 3);
  const bodyNormals = new Float32Array(keptVertices.length * 3);
  const uvs = new Float32Array(keptVertices.length * 2);
  const skinIndices = new Uint16Array(keptVertices.length * 4);
  const skinWeights = new Float32Array(keptVertices.length * 4);
  keptVertices.forEach(({ vertex, group }, at) => {
    point.fromBufferAttribute(position, vertex);
    uvs.set(shell.uv(point, regionAt(vertex), group), at * 2);
    positions.set([point.x, point.y, point.z], at * 3);
    bodyNormals.set([normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex)], at * 3);
    for (let slot = 0; slot < 4; slot++) {
      skinIndices[at * 4 + slot] = skinIndex.getComponent(vertex, slot);
      skinWeights[at * 4 + slot] = skinWeight.getComponent(vertex, slot);
    }
  });
  const triangles = groups.flatMap((group) => group ?? []);
  const skinSurface = new Float32Array(positions);
  const welded = relax(positions, triangles, shell.smoothing);
  keepOutsideBody(positions, skinSurface, bodyNormals);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  const normals = weldedNormals(geometry.getAttribute("normal"), welded);
  const direction = new THREE.Vector3();
  keptVertices.forEach(({ vertex }, at) => {
    point.fromArray(positions, at * 3);
    direction.fromArray(normals, at * 3);
    point.addScaledVector(direction, shell.offset(point, regionAt(vertex)));
    positions.set([point.x, point.y, point.z], at * 3);
  });
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndices, 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeights, 4));
  paintWhite(geometry);
  let start = 0;
  groups.forEach((group, materialIndex) => {
    const count = group?.length ?? 0;
    geometry.addGroup(start, count, materialIndex);
    start += count;
  });
  return geometry;
}
