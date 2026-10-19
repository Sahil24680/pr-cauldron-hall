import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type RefObject, Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Appearance } from "../../../../shared/cast";
import { type CapeBody, createCapeBody, registerCapeBody } from "../cloth/capeBody";
import { Hat } from "../wizard/Hat";
import { Staff, Wand } from "../wizard/HeldItems";
import type { WizardLook } from "../wizard/look";
import { ChestAccents, WaistAccents } from "./Accents";
import { CapeClasp } from "./CapeClasp";
import { Spectacles } from "./Spectacles";
import { type Follower, HEAD_LANDMARKS, assembleHuman } from "./assemble";
import { ANIMATIONS_URL, BODY_URLS, HAIR_URL, HUMAN_SCALE, OUTFIT_PARTS_URL } from "./assets";
import { CROSSFADE_SECONDS, type HumanMotion, MOTION_CLIPS } from "./motions";
import { gripWith, stirPot } from "./stir";

type Props = {
  look: WizardLook;
  appearance: Appearance;
  motion: HumanMotion;
  // Ground speed in hall metres per second, negative when backing up; locomotion clips play faster, slower or in
  // reverse so the feet do not slide.
  pace?: number;
  stone?: boolean;
  frozen?: boolean;
  hideHead?: boolean;
  wandTip?: RefObject<THREE.Mesh | null>;
  // Follows the chest in the unscaled, floor-relative frame the cloth cape is authored in; the cape pins its top edge
  // to it and collides with the capsules this component registers against it.
  capeAnchor?: RefObject<THREE.Group | null>;
  // Where the brew's centre is, in this component's frame; motions that stir circle the wand hand over it.
  pot?: THREE.Vector3;
  // Points in this component's frame the hands grip (a broom handle), and how far the chest leans forward (radians).
  hold?: { left: THREE.Vector3; right: THREE.Vector3 };
  lean?: number;
};

// The hat was modelled for a 0.23 m head; the model's skull is about 0.1 m across the band.
const HAT_SCALE = 0.48;
const HAT_ABOVE_EYES = 0.025;
const HIDDEN_HEAD_SCALE = 0.001;
const MIN_STRIDE_RATE = 0.2;
// Capsules the cape drapes over, in hall metres including the robe and a safety margin so the cape never sinks in.
// The torso is two capsules side by side, which matches a body wider than it is deep.
const CAPE_CAPSULES = [
  { from: "spine_01", to: "neck_01", radius: 0.175, side: -1 },
  { from: "spine_01", to: "neck_01", radius: 0.175, side: 1 },
  { from: "upperarm_l", to: "lowerarm_l", radius: 0.1, side: 0 },
  { from: "lowerarm_l", to: "hand_l", radius: 0.105, side: 0 },
  { from: "upperarm_r", to: "lowerarm_r", radius: 0.1, side: 0 },
  { from: "lowerarm_r", to: "hand_r", radius: 0.105, side: 0 },
  { from: "thigh_l", to: "calf_l", radius: 0.12, side: 0 },
  { from: "calf_l", to: "foot_l", radius: 0.095, side: 0 },
  { from: "thigh_r", to: "calf_r", radius: 0.12, side: 0 },
  { from: "calf_r", to: "foot_r", radius: 0.095, side: 0 },
  { from: "neck_01", to: "Head", radius: 0.14, side: 0 },
] as const;
const TORSO_HALF_SPREAD = 0.07;
const UP = new THREE.Vector3(0, 1, 0);
// The hollow of a closed fist in the hand bone's frame: +Y runs along the fingers, the palm faces +X on the left hand
// (-X on the right), and +Z is the thumb side. The wand is in the left hand, the one the casting clips raise; it leaves
// the fist between thumb and index, angled along the fingers.
const WAND_GRIP = new THREE.Vector3(0.02, 0.07, 0.005);
// Wand angle about the hand's X axis: across the fist toward the thumb, or nearly along the forearm when casting.
const WAND_FIST_TURN = -Math.PI + Math.atan2(0.65, 0.75);
const WAND_POINT_TURN = -Math.PI + Math.atan2(0.2, 1);
const WAND_SCALE = 0.75;
const STAFF_SCALE = 0.95;
const STAFF_LEAN = new THREE.Euler(0.06, 0, -0.05);
const STAFF_FIST = new THREE.Vector3(-0.022, 0.085, 0);

type CapeBones = {
  capsules: { from: THREE.Bone | null; to: THREE.Bone | null; radius: number; side: number }[];
  hips: THREE.Bone | null;
  chest: THREE.Bone | null;
};

// Refreshes the world-space body the cape collides with from the current pose.
function updateCapeBody(body: CapeBody, bones: CapeBones, frame: THREE.Object3D, bulk: number, right: THREE.Vector3) {
  frame.getWorldDirection(body.forward);
  body.forward.y = 0;
  body.forward.normalize();
  right.crossVectors(body.forward, UP).normalize();
  bones.capsules.forEach((source, index) => {
    const capsule = body.capsules[index];
    if (!capsule || !source.from || !source.to) {
      return;
    }
    source.from.getWorldPosition(capsule.start).addScaledVector(right, source.side * TORSO_HALF_SPREAD);
    source.to.getWorldPosition(capsule.end).addScaledVector(right, source.side * TORSO_HALF_SPREAD);
    capsule.radius = source.radius + (source.side === 0 ? 0 : bulk);
  });
  bones.hips?.getWorldPosition(body.hips);
  bones.chest?.getWorldPosition(body.chest);
  body.floorY = frame.getWorldPosition(right).y;
  body.ready = true;
}

function applyFollower(follower: Follower | null, target: THREE.Object3D | null, sceneInverse: THREE.Matrix4) {
  if (!follower || !target) {
    return;
  }
  follower.bone.updateWorldMatrix(true, false);
  target.matrix.multiplyMatrices(sceneInverse, follower.bone.matrixWorld).multiply(follower.restInverse);
  target.matrixWorldNeedsUpdate = true;
}

function useHumanModel(appearance: Appearance, look: WizardLook) {
  const body = useGLTF(BODY_URLS[appearance.build]);
  const hair = useGLTF(HAIR_URL);
  const outfitParts = useGLTF(OUTFIT_PARTS_URL);
  const { animations } = useGLTF(ANIMATIONS_URL);
  const model = useMemo(
    () => assembleHuman(body.scene, { hair: hair.scenes, outfitParts: outfitParts.scenes }, appearance, look),
    [body.scene, hair.scenes, outfitParts.scenes, appearance, look],
  );
  const mixer = useMemo(() => new THREE.AnimationMixer(model.scene), [model.scene]);
  useEffect(
    () => () => {
      mixer.stopAllAction();
    },
    [mixer],
  );
  return { model, mixer, animations };
}

function clipRate(spec: (typeof MOTION_CLIPS)[HumanMotion], pace: number | undefined, frozen: boolean) {
  if (frozen) {
    return 0;
  }
  if (spec.pace && pace !== undefined) {
    return Math.sign(pace || 1) * Math.max(MIN_STRIDE_RATE, Math.abs(pace) / (spec.pace * HUMAN_SCALE));
  }
  return 1;
}

function useMotion(mixer: THREE.AnimationMixer, animations: THREE.AnimationClip[], motion: HumanMotion) {
  const current = useRef<THREE.AnimationAction | null>(null);
  useEffect(() => {
    const spec = MOTION_CLIPS[motion];
    const clip = animations.find((candidate) => candidate.name === spec.clip);
    if (!clip) {
      return;
    }
    const next = mixer.clipAction(clip);
    const previous = current.current;
    next.reset();
    next.setLoop(spec.loop ? THREE.LoopRepeat : THREE.LoopOnce, Number.POSITIVE_INFINITY);
    next.clampWhenFinished = !spec.loop;
    if (!previous && spec.loop) {
      next.time = Math.random() * clip.duration;
    }
    next.fadeIn(previous ? CROSSFADE_SECONDS : 0).play();
    if (previous && previous !== next) {
      previous.fadeOut(CROSSFADE_SECONDS);
    }
    current.current = next;
  }, [mixer, animations, motion]);
  return current;
}

function HumanWizardModel({
  look,
  appearance,
  motion,
  pace,
  stone = false,
  frozen = false,
  hideHead = false,
  wandTip,
  capeAnchor,
  pot,
  hold,
  lean = 0,
}: Props) {
  const { model, mixer, animations } = useHumanModel(appearance, look);
  const action = useMotion(mixer, animations, motion);
  const ownTip = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const wandHand = useRef<THREE.Group>(null);
  const wandGrip = useRef<THREE.Group>(null);
  const staffHand = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const pelvis = useRef<THREE.Group>(null);
  const frame = useRef<THREE.Group>(null);
  const scratch = useMemo(
    () => ({
      sceneInverse: new THREE.Matrix4(),
      scale: new THREE.Matrix4().makeScale(HUMAN_SCALE, HUMAN_SCALE, HUMAN_SCALE),
      unscale: new THREE.Matrix4().makeScale(1 / HUMAN_SCALE, 1 / HUMAN_SCALE, 1 / HUMAN_SCALE),
      right: new THREE.Vector3(),
      fist: new THREE.Vector3(),
    }),
    [],
  );
  const landmarks = HEAD_LANDMARKS[appearance.build];
  const capeBody = useMemo(() => createCapeBody(CAPE_CAPSULES.length), []);
  const capeBones = useMemo(() => {
    const bone = (name: string) => model.body.skeleton.getBoneByName(name) ?? null;
    return {
      capsules: CAPE_CAPSULES.map((capsule) => ({ from: bone(capsule.from), to: bone(capsule.to), radius: capsule.radius, side: capsule.side })),
      hips: bone("pelvis"),
      chest: bone("spine_03"),
    };
  }, [model]);
  const accents = { look, choices: appearance.accents, landmarks: model.landmarks, bulk: model.bulk, body: model.body };

  useEffect(() => {
    model.body.material = stone ? model.stone : model.skin;
  }, [model, stone]);

  useFrame((state, delta) => {
    const spec = MOTION_CLIPS[motion];
    if (action.current) {
      action.current.timeScale = clipRate(spec, pace, frozen);
    }
    // The mixer keeps running when frozen: a stopped mixer never fades the pose in, leaving the bind T-pose.
    mixer.update(Math.min(delta, 0.1));
    const freeHandGrips = look.staff || hold ? model.grips.freeHand : [];
    for (const { bone, closed } of [...model.grips.wandHand, ...freeHandGrips]) {
      bone.quaternion.copy(closed);
    }
    if (lean !== 0) {
      model.spine?.rotateX(lean);
    }
    if (hold && model.arms && frame.current) {
      gripWith(model.arms, frame.current, hold);
    } else if (spec.stirs && pot && model.arms && frame.current) {
      stirPot(model.arms.left, frame.current, pot, state.clock.elapsedTime);
    }
    if (spec.wandAim === "point" && model.wandWrist) {
      model.wandWrist.bone.quaternion.copy(model.wandWrist.straight);
    }
    if (wandGrip.current) {
      wandGrip.current.rotation.x = spec.wandAim === "point" ? WAND_POINT_TURN : WAND_FIST_TURN;
    }
    if (hideHead) {
      model.head?.scale.setScalar(HIDDEN_HEAD_SCALE);
    }
    for (const material of model.ownMaterials) {
      material.opacity = look.skin.opacity;
    }

    model.scene.updateWorldMatrix(true, false);
    scratch.sceneInverse.copy(model.scene.matrixWorld).invert();
    applyFollower(model.followers.head, head.current, scratch.sceneInverse);
    applyFollower(model.followers.wandHand, wandHand.current, scratch.sceneInverse);
    applyFollower(model.followers.chest, chest.current, scratch.sceneInverse);
    applyFollower(model.followers.pelvis, pelvis.current, scratch.sceneInverse);
    const anchor = capeAnchor?.current;
    if (anchor && chest.current) {
      anchor.matrix.multiplyMatrices(scratch.scale, chest.current.matrix).multiply(scratch.unscale);
      anchor.matrixWorldNeedsUpdate = true;
      if (frame.current) {
        updateCapeBody(capeBody, capeBones, frame.current, model.bulk * HUMAN_SCALE, scratch.right);
        registerCapeBody(anchor, capeBody);
      }
    }
    const staffFollower = model.followers.staffHand;
    if (staffFollower && staffHand.current) {
      staffFollower.bone.updateWorldMatrix(true, false);
      scratch.fist.copy(STAFF_FIST).applyMatrix4(staffFollower.bone.matrixWorld).applyMatrix4(scratch.sceneInverse);
      staffHand.current.position.copy(scratch.fist);
    }
  });

  return (
    <group ref={frame}>
      <group scale={HUMAN_SCALE}>
        <primitive object={model.scene}>
          <group ref={head} matrixAutoUpdate={false}>
            <group position={[0, landmarks.eyeY + HAT_ABOVE_EYES, 0]} scale={HAT_SCALE}>
              <Hat look={look} />
            </group>
            {appearance.glasses !== "none" && <Spectacles look={look} landmarks={landmarks} style={appearance.glasses} />}
          </group>
          <group ref={wandHand} matrixAutoUpdate={false}>
            <group ref={wandGrip} position={WAND_GRIP} rotation-x={WAND_FIST_TURN} scale={WAND_SCALE}>
              <Wand look={look} tipRef={wandTip ?? ownTip} />
            </group>
          </group>
          <group ref={chest} matrixAutoUpdate={false}>
            <ChestAccents {...accents} />
            {appearance.cape !== "none" && <CapeClasp look={look} at={model.clasp} />}
          </group>
          <group ref={pelvis} matrixAutoUpdate={false}>
            <WaistAccents {...accents} />
          </group>
          {look.staff && (
            <group ref={staffHand}>
              <group rotation={STAFF_LEAN} scale={STAFF_SCALE}>
                <Staff look={look} />
              </group>
            </group>
          )}
        </primitive>
      </group>
      {capeAnchor && <group ref={capeAnchor} matrixAutoUpdate={false} />}
    </group>
  );
}

export function HumanWizard(props: Props) {
  return (
    <Suspense fallback={null}>
      <HumanWizardModel {...props} />
    </Suspense>
  );
}
