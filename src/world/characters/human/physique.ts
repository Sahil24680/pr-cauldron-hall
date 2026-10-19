import * as THREE from "three";
import type { Appearance } from "../../../../shared/cast";
import { regionOf, weldGroups, weldedNormals } from "./shell";

export type Physique = Appearance["physique"];

// Metres the torso and limbs are pushed in or out along their normals; head, hands and feet keep their shape.
export const PHYSIQUE_BULK: Record<Physique, number> = { slender: -0.008, average: 0, broad: 0.014 };
const KEEPS_SHAPE = new Set(["head", "hand", "foot"]);

function positionsOf(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const positions = new Float32Array(attribute.count * 3);
  for (let vertex = 0; vertex < attribute.count; vertex++) {
    positions.set([attribute.getX(vertex), attribute.getY(vertex), attribute.getZ(vertex)], vertex * 3);
  }
  return positions;
}

// The models store vertices interleaved; cloning would de-interleave and scramble the joint indices, so the reshaped
// body shares every attribute with the original except a fresh position buffer.
// Feet stay inside the modeled boots, so their triangles are dropped rather than left to poke through the leather.
function indexWithoutFeet(geometry: THREE.BufferGeometry, bones: THREE.Bone[]) {
  const index = geometry.getIndex();
  if (!index) {
    return null;
  }
  const skinIndex = geometry.getAttribute("skinIndex");
  const skinWeight = geometry.getAttribute("skinWeight");
  const isFoot = (vertex: number) => {
    let best = 0;
    for (let slot = 1; slot < 4; slot++) {
      if (skinWeight.getComponent(vertex, slot) > skinWeight.getComponent(vertex, best)) {
        best = slot;
      }
    }
    return regionOf(bones[skinIndex.getComponent(vertex, best)]?.name ?? "") === "foot";
  };
  const kept: number[] = [];
  for (let corner = 0; corner + 2 < index.count; corner += 3) {
    const triangle = [index.getX(corner), index.getX(corner + 1), index.getX(corner + 2)];
    if (!triangle.every(isFoot)) {
      kept.push(...triangle);
    }
  }
  return kept;
}

export function reshapeBody(geometry: THREE.BufferGeometry, bones: THREE.Bone[], bulk: number) {
  const reshaped = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    reshaped.setAttribute(name, attribute);
  }
  reshaped.setIndex(indexWithoutFeet(geometry, bones) ?? geometry.getIndex());
  if (bulk === 0) {
    return reshaped;
  }
  const positions = positionsOf(geometry.getAttribute("position"));
  const skinIndex = geometry.getAttribute("skinIndex");
  const skinWeight = geometry.getAttribute("skinWeight");
  const normals = weldedNormals(geometry.getAttribute("normal"), weldGroups(positions).groupOf);
  for (let vertex = 0; vertex < skinIndex.count; vertex++) {
    let fixedShare = 0;
    for (let slot = 0; slot < 4; slot++) {
      if (KEEPS_SHAPE.has(regionOf(bones[skinIndex.getComponent(vertex, slot)]?.name ?? ""))) {
        fixedShare += skinWeight.getComponent(vertex, slot);
      }
    }
    const push = bulk * (1 - fixedShare);
    for (let axis = 0; axis < 3; axis++) {
      positions[vertex * 3 + axis] = (positions[vertex * 3 + axis] ?? 0) + (normals[vertex * 3 + axis] ?? 0) * push;
    }
  }
  reshaped.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  reshaped.computeBoundingSphere();
  return reshaped;
}
