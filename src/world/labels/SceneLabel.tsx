import { useFrame } from "@react-three/fiber";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createLabelId, findLabelElement, hideLabel, readSafeArea, showLabel } from "./labelStore";
import { placeLabel } from "./placeLabel";

type Props = { position?: [number, number, number]; children: ReactNode };

const Z_INDEX_PER_METER = 10;
const inCamera = new THREE.Vector3();

// Replaces drei <Html>, whose per-label React root remounts when R3F connects its events and then blanks or crashes the label.
export function SceneLabel({ position, children }: Props) {
  const [id] = useState(createLabelId);
  const anchor = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    showLabel(id, children);
  }, [id, children]);
  useLayoutEffect(() => () => hideLabel(id), [id]);

  useFrame(({ camera, size }) => {
    const group = anchor.current;
    const label = findLabelElement(id);
    const area = readSafeArea();
    if (!group || !label || !area) {
      return;
    }
    camera.updateMatrixWorld();
    group.updateWorldMatrix(true, false);
    inCamera.setFromMatrixPosition(group.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    const distance = -inCamera.z;
    const screen = inCamera.applyMatrix4(camera.projectionMatrix);
    const spot =
      distance > 0
        ? placeLabel({ x: size.left + ((screen.x + 1) / 2) * size.width, y: size.top + ((1 - screen.y) / 2) * size.height }, label.size, area)
        : null;
    const { style } = label.element;
    style.visibility = spot ? "visible" : "hidden";
    if (spot) {
      style.transform = `translate3d(${spot.left}px, ${spot.top}px, 0)`;
      style.zIndex = String(Math.max(0, Math.round((camera.far - distance) * Z_INDEX_PER_METER)));
    }
  });

  return <group ref={anchor} position={position} />;
}
