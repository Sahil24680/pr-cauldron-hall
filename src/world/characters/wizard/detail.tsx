import { useFrame } from "@react-three/fiber";
import { type ReactNode, useMemo, useRef } from "react";
import * as THREE from "three";
import type { WizardLook } from "./look";

// Beyond this distance small accessories hide and cloth drops its relief maps and sheen; the band stops
// wizards near the boundary from flickering between the two.
const DETAIL_DISTANCE = 15;
const HYSTERESIS = 1;

function nearCamera(object: THREE.Object3D, camera: THREE.Camera, wasNear: boolean, point: THREE.Vector3) {
  const distance = object.getWorldPosition(point).distanceTo(camera.position);
  return distance < DETAIL_DISTANCE + (wasNear ? HYSTERESIS : -HYSTERESIS);
}

function useNearCamera(onChange: (near: boolean) => void) {
  const anchor = useRef<THREE.Group>(null);
  const state = useMemo(() => ({ near: true, point: new THREE.Vector3() }), []);
  useFrame(({ camera }) => {
    if (!anchor.current) {
      return;
    }
    const near = nearCamera(anchor.current, camera, state.near, state.point);
    if (near !== state.near) {
      state.near = near;
      onChange(near);
    }
  });
  return anchor;
}

// Children render only while the camera is close.
export function NearOnly({ children }: { children: ReactNode }) {
  const group = useNearCamera((near) => {
    if (group.current) {
      group.current.visible = near;
    }
  });
  return <group ref={group}>{children}</group>;
}

type Detail = Pick<THREE.MeshPhysicalMaterial, "normalMap" | "roughnessMap" | "metalnessMap" | "roughness" | "metalness" | "sheen">;
// A band painted with metal thread averages out to this once its sheen map is dropped.
const THREAD_AVERAGE = { roughness: 0.7, metalness: 0.25 };
// The photo roughness maps average about this, so a material keeps its overall gloss without them.
const PHOTO_ROUGHNESS_AVERAGE = 0.7;
const fullDetail = new WeakMap<THREE.Material, Detail>();

function farRoughness(saved: Detail, threaded: boolean, mapped: boolean) {
  if (threaded) {
    return THREAD_AVERAGE.roughness;
  }
  return mapped ? saved.roughness * PHOTO_ROUGHNESS_AVERAGE : saved.roughness;
}

function setDetail(material: THREE.MeshStandardMaterial, near: boolean) {
  const saved = fullDetail.get(material) ?? {
    normalMap: material.normalMap,
    roughnessMap: material.roughnessMap,
    metalnessMap: material.metalnessMap,
    roughness: material.roughness,
    metalness: material.metalness,
    sheen: material instanceof THREE.MeshPhysicalMaterial ? material.sheen : 0,
  };
  fullDetail.set(material, saved);
  material.normalMap = near ? saved.normalMap : null;
  material.roughnessMap = near ? saved.roughnessMap : null;
  material.metalnessMap = near ? saved.metalnessMap : null;
  const threaded = saved.metalnessMap !== null && !near;
  const mapped = saved.roughnessMap !== null && !near;
  material.roughness = farRoughness(saved, threaded, mapped);
  material.metalness = threaded ? THREAD_AVERAGE.metalness : saved.metalness;
  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.sheen = near ? saved.sheen : 0;
  }
  material.needsUpdate = true;
}

// Far wizards fill few pixels, so their cloth switches to the cheaper shader without relief maps or sheen.
export function ClothDetail({ look }: { look: WizardLook }) {
  const anchor = useNearCamera((near) => {
    for (const material of [
      look.robe,
      look.robeFolds,
      look.tunic,
      look.liningInside,
      look.cape,
      look.hat,
      look.trim,
      look.leather,
      look.boots,
      look.breeches,
    ]) {
      setDetail(material, near);
    }
  });
  return <group ref={anchor} />;
}
