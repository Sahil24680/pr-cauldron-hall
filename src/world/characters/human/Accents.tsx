import { useEffect } from "react";
import * as THREE from "three";
import type { Accents as AccentChoices } from "../../../../shared/cast";
import { ClothDetail, NearOnly } from "../wizard/detail";
import type { WizardLook } from "../wizard/look";
import { accentShapesFor } from "./accentShapes";
import { fittedAccentsFor } from "./fittedAccents";
import type { BodyLandmarks } from "./landmarks";
import { SKIRT_WAIST } from "./skirt";

// Rigid accessories that ride on the chest or pelvis bone, authored in the bind pose against the body's landmarks, and
// fitted ones (sash, collar, hood) that span several bones and are skinned to the body like the garments.
const BELT = { tube: 0.016, above: 0, buckle: new THREE.BoxGeometry(0.07, 0.055, 0.02) };

type Props = { look: WizardLook; choices: AccentChoices; landmarks: BodyLandmarks; bulk: number; body: THREE.SkinnedMesh };

type WornProps = { body: THREE.SkinnedMesh; geometry: THREE.BufferGeometry; material: THREE.Material };

function Worn({ body, geometry, material }: WornProps) {
  useEffect(() => {
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.bind(body.skeleton, body.bindMatrix);
    mesh.frustumCulled = false;
    body.parent?.add(mesh);
    return () => {
      mesh.removeFromParent();
    };
  }, [body, geometry, material]);
  return null;
}

export function ChestAccents({ look, choices, landmarks, bulk, body }: Props) {
  const shapes = accentShapesFor(landmarks, bulk);
  const fitted = fittedAccentsFor(body, look.outfit, landmarks, bulk);
  return (
    <>
      <ClothDetail look={look} />
      {choices.pendant && (
        <NearOnly>
          <mesh geometry={shapes.pendant.gold} material={look.gold} />
          <mesh geometry={shapes.pendant.stone} material={look.gem} />
        </NearOnly>
      )}
      {choices.sash && <Worn body={body} geometry={fitted.sash} material={look.trim} />}
      {choices.collar && (
        <>
          <Worn body={body} geometry={fitted.collar.sheet} material={look.trim} />
          <Worn body={body} geometry={fitted.collar.sheet} material={look.liningInside} />
          <Worn body={body} geometry={fitted.collar.piping} material={look.gold} />
        </>
      )}
      {choices.hood && (
        <>
          <Worn body={body} geometry={fitted.hood.roll} material={look.cape} />
          <Worn body={body} geometry={fitted.hood.pouch} material={look.cape} />
        </>
      )}
    </>
  );
}

export function WaistAccents({ look, choices, landmarks, bulk }: Props) {
  const shapes = accentShapesFor(landmarks, bulk);
  const radius = SKIRT_WAIST.radius + bulk + BELT.tube * 0.6;
  return (
    <>
      {choices.belt && (
        <group position={[0, landmarks.waistY + BELT.above, SKIRT_WAIST.centerZ]}>
          <mesh material={look.leather} rotation={[Math.PI / 2, 0, 0]} scale={[1, SKIRT_WAIST.depthRatio, 1]}>
            <torusGeometry args={[radius, BELT.tube, 6, 40]} />
          </mesh>
          <mesh geometry={BELT.buckle} material={look.gold} position={[0, 0, radius * SKIRT_WAIST.depthRatio + BELT.tube]} />
        </group>
      )}
      <NearOnly>
        {choices.pouch && (
          <>
            <mesh geometry={shapes.pouch.leather} material={look.leather} />
            <mesh geometry={shapes.pouch.gold} material={look.gold} />
          </>
        )}
        {choices.scrollCase && (
          <>
            <mesh geometry={shapes.scrollCase.leather} material={look.leather} />
            <mesh geometry={shapes.scrollCase.gold} material={look.gold} />
          </>
        )}
      </NearOnly>
    </>
  );
}
