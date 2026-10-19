import * as THREE from "three";
import { ROBE_TILES_AROUND } from "../wizard/fabric";
import type { Outfit } from "../wizard/look";
import { trimTilesAround } from "../wizard/trimBand";
import type { BodyLandmarks } from "./landmarks";
import { GARMENT_GROUP } from "./materialGroups";
import { type Region, dominantRegions, extractShell, paintWhite, wrapUv } from "./shell";
import { buildSkirt } from "./skirt";

// Trousers stop just inside the modeled boots: shoes with robes and coats, tall boots with long coats.
const BOOT_TOP_Y: Record<Outfit, number> = { robe: 0.4, coat: 0.4, longcoat: 0.5 };
const SLEEVE_FLARE: Record<Outfit, number> = { robe: 0.055, coat: 0.012, longcoat: 0.03 };
const THICKNESS = { tunic: 0.016, trousers: 0.009 };
const SMOOTHING = { tunic: 40, trousers: 16 };
const CUFF_WIDTH = 0.05;
const PANEL_HALF_WIDTH = 0.055;
// Triangles where hip meets thigh belong to neither the tunic (torso) nor the legs, so trousers rise this far to close them.
const SEAT_ABOVE_HIP = 0.08;
// The cape's yoke: a layer over the tunic across the shoulders and the top of the back, open at the chest, from which
// the swinging cloth hangs.
const YOKE = { belowShoulders: 0.14, frontReach: 0.06, aboveShoulders: 0.02, halfWidth: 0.22, lift: 0.01, textureSpan: 0.45 };

export type GarmentSet = {
  tunic: THREE.BufferGeometry;
  trousers: THREE.BufferGeometry;
  skirt: THREE.BufferGeometry;
  lapels: THREE.BufferGeometry;
  yoke: THREE.BufferGeometry;
};

// Lapels are a band laid on the tunic's front, widening and moving outward from waist to collar. It is cut from the
// tunic shell itself, so it folds with the cloth, and its UVs run along (u) and across (v) the band so trim cords line
// both edges; triangles reach a little past the band and an alpha mask trims them to a clean edge.
const LAPEL = { innerAtWaist: 0.015, innerAtCollar: 0.07, widthAtWaist: 0.025, widthAtCollar: 0.045, margin: 0.015, lift: 0.003, repeatMetres: 0.18 };

function lapelBand(rise: number) {
  const inner = LAPEL.innerAtWaist + (LAPEL.innerAtCollar - LAPEL.innerAtWaist) * rise;
  const width = LAPEL.widthAtWaist + (LAPEL.widthAtCollar - LAPEL.widthAtWaist) * rise;
  return { inner, width };
}

// Copies the shell's triangles whose corners all pass `keep`, lifted `lift` metres along the shell's own normals, with
// UVs from `uvOf`; layering on the finished shell keeps the copy outside it everywhere.
function layerFromShell(shell: THREE.BufferGeometry, keep: (vertex: number) => boolean, lift: number, uvOf: (vertex: number) => [number, number]) {
  const position = shell.getAttribute("position");
  const normal = shell.getAttribute("normal");
  const index = shell.getIndex();
  const kept = new Map<number, number>();
  const triangles: number[] = [];
  for (let corner = 0; index && corner + 2 < index.count; corner += 3) {
    const triangle = [index.getX(corner), index.getX(corner + 1), index.getX(corner + 2)];
    if (triangle.every(keep)) {
      for (const vertex of triangle) {
        if (!kept.has(vertex)) {
          kept.set(vertex, kept.size);
        }
        triangles.push(kept.get(vertex) ?? 0);
      }
    }
  }
  const copy = (name: string, size: number) => {
    const source = shell.getAttribute(name);
    const values = new Float32Array(kept.size * size);
    for (const [vertex, at] of kept) {
      for (let component = 0; component < size; component++) {
        values[at * size + component] = source.getComponent(vertex, component);
      }
    }
    return new THREE.BufferAttribute(values, size);
  };
  const positions = copy("position", 3);
  const uvs = new Float32Array(kept.size * 2);
  for (const [vertex, at] of kept) {
    positions.setXYZ(
      at,
      position.getX(vertex) + normal.getX(vertex) * lift,
      position.getY(vertex) + normal.getY(vertex) * lift,
      position.getZ(vertex) + normal.getZ(vertex) * lift,
    );
    uvs.set(uvOf(vertex), at * 2);
  }
  const layer = new THREE.BufferGeometry();
  layer.setAttribute("position", positions);
  layer.setAttribute("normal", copy("normal", 3));
  layer.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  layer.setAttribute("skinIndex", new THREE.BufferAttribute(Uint16Array.from(copy("skinIndex", 4).array), 4));
  layer.setAttribute("skinWeight", copy("skinWeight", 4));
  layer.setIndex(triangles);
  return paintWhite(layer);
}

function buildLapels(tunic: THREE.BufferGeometry, waistY: number, neckBaseY: number) {
  const position = tunic.getAttribute("position");
  const height = neckBaseY - waistY;
  const riseOf = (vertex: number) => (position.getY(vertex) - waistY) / height;
  const bandAt = (vertex: number) => lapelBand(Math.min(1, Math.max(0, riseOf(vertex))));
  const inBand = (vertex: number) => {
    const rise = riseOf(vertex);
    const { inner, width } = bandAt(vertex);
    const across = Math.abs(position.getX(vertex));
    return position.getZ(vertex) > 0 && rise > -0.05 && rise < 1.05 && across > inner - LAPEL.margin && across < inner + width + LAPEL.margin;
  };
  return layerFromShell(tunic, inBand, LAPEL.lift, (vertex) => {
    const { inner, width } = bandAt(vertex);
    return [(riseOf(vertex) * height) / LAPEL.repeatMetres, (Math.abs(position.getX(vertex)) - inner) / width];
  });
}

// The yoke's texture is laid from behind and above, so the fabric runs evenly over the shoulder tops and down the back
// instead of streaking where a body-wrapped layout pinches at the neck.
function buildYoke(tunic: THREE.BufferGeometry, shoulderY: number) {
  const position = tunic.getAttribute("position");
  const keep = (vertex: number) => {
    const y = position.getY(vertex);
    const z = position.getZ(vertex);
    return (
      Math.abs(position.getX(vertex)) < YOKE.halfWidth && y > shoulderY - YOKE.belowShoulders && (z < YOKE.frontReach || y > shoulderY + YOKE.aboveShoulders)
    );
  };
  return layerFromShell(tunic, keep, YOKE.lift, (vertex) => [
    position.getX(vertex) / YOKE.textureSpan + 0.5,
    (position.getY(vertex) - position.getZ(vertex)) / (YOKE.textureSpan * Math.SQRT2),
  ]);
}

// Round and along the left arm's axis, from the shoulder joint to the wrist; the right arm is its mirror image.
function sleeveFrame(bones: THREE.Bone[]) {
  const at = (name: string) => bones.find((bone) => bone.name === name)?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
  const shoulder = at("upperarm_l");
  const along = at("hand_l").sub(shoulder).normalize();
  const forward = new THREE.Vector3(0, 0, 1);
  const up = forward.clone().cross(along);
  const offset = new THREE.Vector3();
  return (point: THREE.Vector3) => {
    offset.set(Math.abs(point.x), point.y, point.z).sub(shoulder);
    const length = offset.dot(along);
    offset.addScaledVector(along, -length);
    return { around: Math.atan2(offset.dot(up), offset.dot(forward)), along: length, radius: offset.length() };
  };
}

type SleeveFrame = ReturnType<typeof sleeveFrame>;

// Where the sleeve ends and how thick the arm is inside the cuff, read from the body's arm vertices past `start`.
function measureCuff(geometry: THREE.BufferGeometry, regions: Region[], start: number, frame: SleeveFrame) {
  const position = geometry.getAttribute("position");
  const point = new THREE.Vector3();
  let end = start;
  let radiusSum = 0;
  let count = 0;
  for (let vertex = 0; vertex < position.count; vertex++) {
    point.fromBufferAttribute(position, vertex);
    if (regions[vertex] === "arm" && Math.abs(point.x) > start) {
      end = Math.max(end, Math.abs(point.x));
      radiusSum += frame(point).radius;
      count++;
    }
  }
  return { end, radius: count > 0 ? radiusSum / count : 0 };
}

function buildGarments(body: THREE.SkinnedMesh, outfit: Outfit, landmarks: BodyLandmarks, bulk: number): GarmentSet {
  const bones = body.skeleton.bones;
  const regions = dominantRegions(body.geometry, bones);
  const bootTop = BOOT_TOP_Y[outfit];
  const { elbowX, wristX, shoulderY, hipY, waistY, neckBaseY } = landmarks;
  const armProgress = (point: THREE.Vector3) => Math.min(1, Math.max(0, (Math.abs(point.x) - elbowX) / (wristX - elbowX)));
  const sleeve = sleeveFrame(bones);
  // A sleeve wears one robe tile round the arm: the body's pattern scale, and clear of the front band painted at u = 0.5.
  const bodyUv = (point: THREE.Vector3, region: Region): [number, number] => {
    if (region === "arm") {
      const { around, along } = sleeve(point);
      const [u, v] = wrapUv(around, along);
      return [u / ROBE_TILES_AROUND, v];
    }
    return wrapUv(Math.atan2(point.x, point.z), point.y);
  };
  const cuffStart = wristX - CUFF_WIDTH;
  const cuff = measureCuff(body.geometry, regions, cuffStart, sleeve);
  const cuffTiles = trimTilesAround(Math.PI * 2 * (cuff.radius + THICKNESS.tunic + SLEEVE_FLARE[outfit]), cuff.end - cuffStart);
  const cuffUv = (point: THREE.Vector3): [number, number] => [
    (sleeve(point).around / (Math.PI * 2) + 0.5) * cuffTiles,
    THREE.MathUtils.clamp((Math.abs(point.x) - cuffStart) / (cuff.end - cuffStart), 0, 1),
  ];
  const tunicGroup = (point: THREE.Vector3, region: Region) => {
    if (region === "arm") {
      return Math.abs(point.x) > cuffStart ? GARMENT_GROUP.trim : GARMENT_GROUP.sleeve;
    }
    return Math.abs(point.x) < PANEL_HALF_WIDTH && point.z > 0 ? GARMENT_GROUP.panel : GARMENT_GROUP.fabric;
  };

  const tunic = extractShell(body.geometry, regions, {
    keep: (_, region) => region === "torso" || region === "arm",
    offset: (point, region) => THICKNESS.tunic + (region === "arm" ? SLEEVE_FLARE[outfit] * armProgress(point) ** 2 : 0),
    group: tunicGroup,
    smoothing: SMOOTHING.tunic,
    uv: (point, region, group) => (group === GARMENT_GROUP.trim ? cuffUv(point) : bodyUv(point, region)),
  });
  const trousers = extractShell(body.geometry, regions, {
    keep: (point, region) => (region === "leg" || (region === "torso" && point.y < hipY + SEAT_ABOVE_HIP)) && point.y > bootTop - 0.02,
    offset: () => THICKNESS.trousers,
    group: () => GARMENT_GROUP.fabric,
    smoothing: SMOOTHING.trousers,
    uv: bodyUv,
  });
  const yoke = buildYoke(tunic, shoulderY);
  return { tunic, trousers, skirt: buildSkirt(outfit, bones, landmarks, bulk), lapels: buildLapels(tunic, waistY, neckBaseY), yoke };
}

const cache = new Map<string, GarmentSet>();

// Garments depend only on the body shape and outfit, so every wizard wearing the same pair shares the geometry.
export function garmentsFor(shapeKey: string, body: THREE.SkinnedMesh, outfit: Outfit, landmarks: BodyLandmarks, bulk: number) {
  const id = `${shapeKey}:${outfit}`;
  const cached = cache.get(id);
  if (cached) {
    return cached;
  }
  const built = buildGarments(body, outfit, landmarks, bulk);
  cache.set(id, built);
  return built;
}
