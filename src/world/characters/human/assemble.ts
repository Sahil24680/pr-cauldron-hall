import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Appearance } from "../../../../shared/cast";
import type { WizardLook } from "../wizard/look";
import type { Arm } from "./armReach";
import type { HumanBuild } from "./assets";
import { garmentsFor } from "./garments";
import { type BodyLandmarks, measureLandmarks } from "./landmarks";
import { GARMENT_GROUP } from "./materialGroups";
import { PHYSIQUE_BULK, reshapeBody } from "./physique";

// Landmarks of each model's bind pose, in model metres.
export const HEAD_LANDMARKS: Record<HumanBuild, { eyeY: number; eyeX: number; eyeFrontZ: number; crownY: number }> = {
  male: { eyeY: 1.699, eyeX: 0.033, eyeFrontZ: 0.081, crownY: 1.81 },
  female: { eyeY: 1.657, eyeX: 0.034, eyeFrontZ: 0.075, crownY: 1.767 },
};

// The body texture's average skin; a look's skin colour tints it by the per-channel ratio, so the texture's average
// lands on the chosen tone. The cap only guards against a near-black reference channel blowing up.
const TEXTURE_SKIN = new THREE.Color("#d29a78");
const MAX_SKIN_LIFT = 3;
const FINGERS = ["index", "middle", "ring", "pinky"];
// Knuckle, middle and tip joint bends (radians) that close the hand around a wand or staff.
const GRIP_CURL = [1.15, 1.35, 0.9];
const THUMB_CURL = [0.25, 0.45, 0.35];

export type Follower = { bone: THREE.Bone; restInverse: THREE.Matrix4 };
// A closed-hand joint rotation, set from the bind pose so every clip's open or relaxed hand becomes the same fist.
export type Grip = { bone: THREE.Bone; closed: THREE.Quaternion };

export type HumanModel = {
  scene: THREE.Object3D;
  head: THREE.Bone | null;
  // The wand hand's bind rotation: a straight wrist, so a pointed wand follows the forearm.
  wandWrist: { bone: THREE.Bone; straight: THREE.Quaternion } | null;
  followers: Record<"head" | "wandHand" | "staffHand" | "chest" | "pelvis", Follower | null>;
  landmarks: BodyLandmarks;
  bulk: number;
  // Where the cape's clasp rests: on the robe's front surface just under the collar (bind-pose model metres).
  clasp: { y: number; z: number };
  grips: { wandHand: Grip[]; freeHand: Grip[] };
  // Both arms, for reaching hands to a target (the wand hand over the pot, both hands on a broom handle), and the
  // spine bone a rider leans with.
  arms: { left: Arm; right: Arm } | null;
  spine: THREE.Bone | null;
  ownMaterials: THREE.MeshStandardMaterial[];
  skin: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  body: THREE.SkinnedMesh;
};

function isSkinned(object: THREE.Object3D): object is THREE.SkinnedMesh {
  return object instanceof THREE.SkinnedMesh;
}

function standardMaterialOf(mesh: THREE.Mesh) {
  return mesh.material instanceof THREE.MeshStandardMaterial ? mesh.material : null;
}

function skinTint(skin: THREE.Color) {
  const ratio = (channel: number, reference: number) => Math.min(MAX_SKIN_LIFT, channel / reference);
  return new THREE.Color(ratio(skin.r, TEXTURE_SKIN.r), ratio(skin.g, TEXTURE_SKIN.g), ratio(skin.b, TEXTURE_SKIN.b));
}

// The hair and outfit files hold one armature per piece, so the loader suffixes repeated bone names ("Head_3").
function matchingBone(skeleton: THREE.Skeleton, bone: THREE.Bone) {
  return skeleton.getBoneByName(bone.name) ?? skeleton.getBoneByName(bone.name.replace(/_\d+$/, "")) ?? bone;
}

function rebindToSkeleton(source: THREE.SkinnedMesh, body: THREE.SkinnedMesh, material: THREE.Material) {
  const bones = source.skeleton.bones.map((bone) => matchingBone(body.skeleton, bone));
  const mesh = new THREE.SkinnedMesh(source.geometry, material);
  mesh.bind(new THREE.Skeleton(bones, source.skeleton.boneInverses), source.bindMatrix);
  return mesh;
}

// One material per garment group (see GARMENT_GROUP), so accents restyle panels and sleeves without new geometry.
function garmentMaterials(look: WizardLook, accents: Appearance["accents"]) {
  const slots: THREE.Material[] = [];
  slots[GARMENT_GROUP.fabric] = look.robe;
  slots[GARMENT_GROUP.trim] = look.trim;
  slots[GARMENT_GROUP.panel] = accents.frontPanel ? look.trim : look.robe;
  slots[GARMENT_GROUP.sleeve] = accents.twoToneSleeves ? look.tunic : look.robe;
  return slots;
}

const CLASP_BELOW_NECK = 0.012;
const CLASP_SEARCH = { halfWidth: 0.07, halfHeight: 0.025, proud: 0.006 };

// The robe's frontmost point near the collar, so the clasp sits on the cloth for any build or physique.
function claspSpot(tunic: THREE.BufferGeometry, neckBaseY: number) {
  const y = neckBaseY - CLASP_BELOW_NECK;
  const position = tunic.getAttribute("position");
  let front = 0;
  for (let vertex = 0; vertex < position.count; vertex++) {
    if (Math.abs(position.getX(vertex)) < CLASP_SEARCH.halfWidth && Math.abs(position.getY(vertex) - y) < CLASP_SEARCH.halfHeight) {
      front = Math.max(front, position.getZ(vertex));
    }
  }
  return { y, z: front + CLASP_SEARCH.proud };
}

// Opaque across the band (v in 0 to 1) and clear in the outermost rows, which clamping stretches over anything outside
// it, so a band cut from whole triangles still ends in a clean line.
const BAND_EDGE_ROWS = 64;
const BAND_EDGE_MASK = new THREE.DataTexture(
  Uint8Array.from({ length: BAND_EDGE_ROWS * 4 }, (_, at) => (Math.floor(at / 4) % (BAND_EDGE_ROWS - 1) === 0 ? 0 : 255)),
  1,
  BAND_EDGE_ROWS,
);
BAND_EDGE_MASK.needsUpdate = true;
const BAND_EDGE_CUTOFF = 0.5;

const reshapedBodies = new Map<string, THREE.BufferGeometry>();

function reshapedBodyFor(key: string, body: THREE.SkinnedMesh, bulk: number) {
  const cached = reshapedBodies.get(key) ?? reshapeBody(body.geometry, body.skeleton.bones, bulk);
  reshapedBodies.set(key, cached);
  return cached;
}

function wearLayer(body: THREE.SkinnedMesh, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]) {
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.bind(body.skeleton, body.bindMatrix);
  mesh.frustumCulled = false;
  body.parent?.add(mesh);
}

// "rest" followers carry things authored in bind-pose model space; "bone" followers carry things authored in the bone's
// own frame, which fits both builds' hands without per-model offsets.
function follow(bone: THREE.Bone | undefined, frame: "rest" | "bone"): Follower | null {
  if (!bone) {
    return null;
  }
  return { bone, restInverse: frame === "rest" ? bone.matrixWorld.clone().invert() : new THREE.Matrix4() };
}

function armOf(skeleton: THREE.Skeleton, side: "l" | "r"): Arm | null {
  const upper = skeleton.getBoneByName(`upperarm_${side}`);
  const lower = skeleton.getBoneByName(`lowerarm_${side}`);
  const hand = skeleton.getBoneByName(`hand_${side}`);
  return upper && lower && hand ? { upper, lower, hand } : null;
}

function bothArms(skeleton: THREE.Skeleton) {
  const left = armOf(skeleton, "l");
  const right = armOf(skeleton, "r");
  return left && right ? { left, right } : null;
}

function gripsFor(side: "l" | "r", skeleton: THREE.Skeleton) {
  const axis = new THREE.Vector3(1, 0, 0);
  const grip = (name: string, angle: number) => {
    const bone = skeleton.getBoneByName(name);
    return bone ? [{ bone, closed: bone.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle)) }] : [];
  };
  return [
    ...FINGERS.flatMap((finger) => GRIP_CURL.flatMap((angle, joint) => grip(`${finger}_0${joint + 1}_${side}`, angle))),
    ...THUMB_CURL.flatMap((angle, joint) => grip(`thumb_0${joint + 1}_${side}`, angle)),
  ];
}

type Wardrobe = { hair: THREE.Object3D[]; outfitParts: THREE.Object3D[] };

export function assembleHuman(bodySource: THREE.Object3D, wardrobe: Wardrobe, appearance: Appearance, look: WizardLook): HumanModel {
  const scene = cloneSkinned(bodySource);
  scene.updateMatrixWorld(true);
  const skinned: THREE.SkinnedMesh[] = [];
  scene.traverse((object) => {
    if (isSkinned(object)) {
      skinned.push(object);
    }
  });
  const byMaterial = (prefix: string) => skinned.find((mesh) => standardMaterialOf(mesh)?.name.startsWith(prefix));
  const body = byMaterial("MI_Superhero");
  if (!body) {
    throw new Error("Character model has no body mesh");
  }
  const transparent = look.skin.transparent;
  const ownMaterials: THREE.MeshStandardMaterial[] = [];
  const own = (material: THREE.MeshStandardMaterial | null, color?: THREE.Color) => {
    const copy = (material ?? new THREE.MeshStandardMaterial()).clone();
    copy.transparent = transparent;
    if (color) {
      copy.color.copy(color);
    }
    ownMaterials.push(copy);
    return copy;
  };

  const skin = own(standardMaterialOf(body), skinTint(look.skin.color));
  const stone = own(null, look.skin.color);
  stone.roughness = 0.95;
  body.material = skin;
  for (const mesh of skinned) {
    if (mesh !== body) {
      mesh.material = own(standardMaterialOf(mesh), mesh === byMaterial("MI_Hair") ? look.hair.color : undefined);
    }
    mesh.frustumCulled = false;
  }

  const bulk = PHYSIQUE_BULK[appearance.physique];
  const shapeKey = `${appearance.build}:${appearance.physique}`;
  body.geometry = reshapedBodyFor(shapeKey, body, bulk);
  const landmarks = measureLandmarks(body.skeleton);
  const garments = garmentsFor(shapeKey, body, look.outfit, landmarks, bulk);
  const slots = garmentMaterials(look, appearance.accents);
  wearLayer(body, garments.trousers, look.breeches);
  wearLayer(body, garments.tunic, slots);
  wearLayer(body, garments.tunic, look.liningInside);
  wearLayer(body, garments.skirt, slots);
  wearLayer(body, garments.skirt, look.liningInside);
  if (appearance.cape !== "none") {
    const yoke = own(look.cape);
    // The cape material shades its body-facing side as lining; the yoke is only ever seen from outside.
    yoke.onBeforeCompile = () => undefined;
    yoke.customProgramCacheKey = () => "cape-yoke";
    yoke.side = THREE.FrontSide;
    wearLayer(body, garments.yoke, yoke);
    wearLayer(body, garments.yoke, look.liningInside);
  }
  if (appearance.accents.lapels) {
    const lapel = own(look.trim);
    lapel.alphaMap = BAND_EDGE_MASK;
    lapel.alphaTest = BAND_EDGE_CUTOFF;
    wearLayer(body, garments.lapels, lapel);
  }

  const boots = look.outfit === "longcoat" ? "TallBoots" : "Shoes";
  const pieces = [
    { scenes: wardrobe.outfitParts, name: `${boots}_${appearance.build}`, color: undefined },
    ...(appearance.accents.pauldrons ? [{ scenes: wardrobe.outfitParts, name: `Pauldrons_${appearance.build}`, color: undefined }] : []),
    { scenes: wardrobe.hair, name: appearance.hair, color: look.hair.color },
    ...(appearance.beard ? [{ scenes: wardrobe.hair, name: "Beard", color: look.beard?.color ?? look.hair.color }] : []),
  ];
  for (const { scenes, name, color } of pieces) {
    const source = scenes.find((scene) => scene.name === name)?.getObjectByProperty("type", "SkinnedMesh");
    if (source && isSkinned(source)) {
      const piece = rebindToSkeleton(source, body, own(standardMaterialOf(source), color));
      piece.frustumCulled = false;
      body.parent?.add(piece);
    }
  }

  const bone = (name: string) => body.skeleton.getBoneByName(name);
  const wandHandBone = bone("hand_l");
  return {
    scene,
    body,
    head: bone("Head") ?? null,
    wandWrist: wandHandBone ? { bone: wandHandBone, straight: wandHandBone.quaternion.clone() } : null,
    followers: {
      head: follow(bone("Head"), "rest"),
      wandHand: follow(bone("hand_l"), "bone"),
      staffHand: follow(bone("hand_r"), "bone"),
      chest: follow(bone("spine_03"), "rest"),
      pelvis: follow(bone("pelvis"), "rest"),
    },
    landmarks,
    bulk,
    clasp: claspSpot(garments.tunic, landmarks.neckBaseY),
    grips: { wandHand: gripsFor("l", body.skeleton), freeHand: gripsFor("r", body.skeleton) },
    arms: bothArms(body.skeleton),
    spine: bone("spine_02") ?? null,
    ownMaterials,
    skin,
    stone,
  };
}
