import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { isSettingsOpen } from "../../lib/settingsMenu";
import { useLatest } from "../../lib/useLatest";
import type { Rect, Station } from "../layout";
import { findTargetId, pullRequestTargets } from "../pullRequests/targets";
import { Avatar } from "./Avatar";
import { FirstPersonWand } from "./FirstPersonWand";
import { OrbitCamera } from "./OrbitCamera";
import { BASE_FOV, cameraBox, firstPersonEye, headBob, highestFlight, playerBounds, targetFov } from "./camera";
import { blockerBoxes } from "./cameraBlockers";
import { MOVE_KEYS, axis, isTyping, useKeyboard } from "./input";
import { RADIANS_PER_PIXEL, RECENTER_WITHIN, clampPitch, edgePush, recenterYaw, turnView } from "./look";
import {
  FLY_SPEED,
  FLY_SPRINT_MULTIPLIER,
  PLAYER_RADIUS,
  RUN_SPEED,
  WALK_SPEED,
  facingForTravel,
  shortestTurn,
  strideRate,
  travelDirection,
  turnToward,
} from "./movement";
import { solidsFromFootprints } from "./orbit";
import type { Player, ViewMode } from "./player";
import { registerLockTarget, requestLock } from "./pointerLock";
import { CAMERA_DISTANCE_RANGE, getPlayerSettings, updatePlayerSettings } from "./settings";

type Props = {
  mode: ViewMode;
  player: RefObject<Player>;
  obstacles: Rect[];
  bounds: Rect;
  stations: Map<number, Station>;
  onNearby: (number: number | null) => void;
  onRead: (number: number) => void;
  onToggleFlight: () => void;
  paused: boolean;
};

const GRAVITY = 20;
const JUMP_SPEED = 6.5;
const WALK_ACCELERATION = 9;
const WALK_BRAKING = 12;
const AIR_CONTROL = 0.35;
const FLY_ACCELERATION = 2.4;
const MOVING_THRESHOLD = 0.15;
const WIZARD_RADIUS = 0.3;
const EDGE_TURN_SPEED = 1.6;
const EDGE_PITCH_SPEED = 0.8;
// A cursor that leaves the canvas and comes back elsewhere, or a pointer-lock glitch, reports one huge movement.
const MOST_LOOK_PIXELS = 80;
// A press that moves the cursor less than this is a click, not a drag.
const CLICK_SLOP_PIXELS = 5;
const TURN_TOWARD_TRAVEL = 10;
const RECENTER_AFTER_LOOK_MS = 2500;
const RECENTER_AFTER_FORWARD_MS = 800;
const RECENTER_PITCH_RATE = 1.2;
const RECENTER_PITCH = -0.2;
const ZOOM_PER_WHEEL_PIXEL = 0.0015;
const WHEEL_LINE_PIXELS = 16;
const FOV_EASE = 6;
const FOV_EPSILON = 0.01;
const READ_REACH = 5;
const AIM_EVERY_FRAMES = 3;
const SCREEN_CENTER = new THREE.Vector2(0, 0);
const NO_KEYS = new Set<string>();
// Runs before default-priority frames, so the first-person wand follows this frame's camera rather than the last one.
const CAMERA_FRAME_PRIORITY = -1;
export const DEFAULT_FOV = BASE_FOV.third;
function isInside(x: number, z: number, rect: Rect) {
  return x > rect.minX - PLAYER_RADIUS && x < rect.maxX + PLAYER_RADIUS && z > rect.minZ - PLAYER_RADIUS && z < rect.maxZ + PLAYER_RADIUS;
}

export function PlayerController({ mode, player, obstacles, bounds, stations, onNearby, onRead, onToggleFlight, paused }: Props) {
  const pausedByScene = useLatest(paused);
  const isPaused = useCallback(() => pausedByScene.current || isSettingsOpen(), [pausedByScene]);
  const toggleFlightUnlessPaused = useCallback(() => {
    if (!isPaused()) {
      onToggleFlight();
    }
  }, [isPaused, onToggleFlight]);
  const { held, jumpRequested, sprinting } = useKeyboard(toggleFlightUnlessPaused);
  const { camera, gl } = useThree();
  const nearby = useRef<number | null>(null);
  const aimed = useRef<number | null>(null);
  const aimFrame = useRef(0);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const cursorRaycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const press = useRef({ held: false, moved: 0 });
  const headingForwardSince = useRef<number | null>(null);
  const walkBounds = useMemo(() => playerBounds(bounds), [bounds]);
  const viewBox = useMemo(() => cameraBox(bounds), [bounds]);
  const cauldrons = useMemo(() => solidsFromFootprints(obstacles), [obstacles]);
  const orbit = useMemo(() => new OrbitCamera(), []);
  const lookedAt = useRef(0);
  const solids = useMemo(
    () => [
      ...obstacles,
      ...[...stations.values()].map(({ spot }) => ({
        minX: spot.x - WIZARD_RADIUS,
        maxX: spot.x + WIZARD_RADIUS,
        minZ: spot.z - WIZARD_RADIUS,
        maxZ: spot.z + WIZARD_RADIUS,
      })),
    ],
    [obstacles, stations],
  );

  useEffect(() => {
    const canvas = gl.domElement;
    registerLockTarget(canvas);
    player.current.pitch = clampPitch(player.current.pitch, mode);
    orbit.reset();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const steerKeys = new Set([...MOVE_KEYS.forward, ...MOVE_KEYS.back, ...MOVE_KEYS.left, ...MOVE_KEYS.right]);
    const captureOnMove = (event: KeyboardEvent) => {
      if (steerKeys.has(event.code) && !isTyping(event.target) && !isPaused()) {
        requestLock();
      }
    };
    const cursorOnCanvas = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
        y: THREE.MathUtils.clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1),
      };
    };
    const targetUnderCursor = (event: MouseEvent) => {
      const at = cursorOnCanvas(event);
      cursorRaycaster.setFromCamera(new THREE.Vector2(at.x, -at.y), camera);
      const hit = cursorRaycaster.intersectObjects([...pullRequestTargets], true)[0];
      return hit ? findTargetId(hit.object) : null;
    };
    // Like Minecraft: a click while playing acts on whatever the crosshair is on; a click while paused resumes, unless it
    // lands on a wizard, which it reads.
    const pressButton = (event: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        event.preventDefault();
        if (aimed.current !== null) {
          onRead(aimed.current);
        }
        return;
      }
      press.current = { held: true, moved: 0 };
      if (targetUnderCursor(event) === null) {
        requestLock();
      }
    };
    const releaseButton = () => {
      press.current.held = false;
    };
    // The scene's own click on a wizard also walks you over to its cauldron, so without pointer lock a click reads here
    // and stops, and so does the end of a drag.
    const click = (event: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        return;
      }
      const target = press.current.moved < CLICK_SLOP_PIXELS ? targetUnderCursor(event) : null;
      if (press.current.moved >= CLICK_SLOP_PIXELS || target !== null) {
        event.stopPropagation();
      }
      if (target !== null) {
        onRead(target);
      }
    };
    const blockMenu = (event: MouseEvent) => event.preventDefault();
    const forgetCursor = () => {
      pointer.current = null;
    };
    // Without pointer lock (the in-app browser refuses it) the view follows the cursor over the canvas, as it always has.
    const look = (event: MouseEvent) => {
      const locked = document.pointerLockElement === canvas;
      if (event.buttons === 0) {
        press.current.held = false;
      }
      if (isPaused() || (!locked && event.target !== canvas)) {
        pointer.current = null;
        return;
      }
      if (!locked) {
        pointer.current = cursorOnCanvas(event);
        if (press.current.held) {
          press.current.moved += Math.abs(event.movementX) + Math.abs(event.movementY);
        }
      }
      const movementX = THREE.MathUtils.clamp(event.movementX, -MOST_LOOK_PIXELS, MOST_LOOK_PIXELS);
      const movementY = THREE.MathUtils.clamp(event.movementY, -MOST_LOOK_PIXELS, MOST_LOOK_PIXELS);
      const { sensitivity, invertY } = getPlayerSettings();
      const radians = RADIANS_PER_PIXEL * sensitivity;
      turnView(player.current, -movementX * radians, movementY * radians * (invertY ? 1 : -1), mode);
      if (movementX !== 0 || movementY !== 0) {
        lookedAt.current = performance.now();
      }
    };
    const zoom = (event: WheelEvent) => {
      if (mode !== "third" || isPaused()) {
        return;
      }
      event.preventDefault();
      const pixels = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * WHEEL_LINE_PIXELS : event.deltaY;
      const distance = getPlayerSettings().cameraDistance * Math.exp(pixels * ZOOM_PER_WHEEL_PIXEL);
      updatePlayerSettings({ cameraDistance: THREE.MathUtils.clamp(distance, CAMERA_DISTANCE_RANGE.min, CAMERA_DISTANCE_RANGE.max) });
    };
    canvas.addEventListener("mousedown", pressButton);
    canvas.addEventListener("click", click);
    canvas.addEventListener("contextmenu", blockMenu);
    canvas.addEventListener("mouseleave", forgetCursor);
    canvas.addEventListener("wheel", zoom, { passive: false });
    window.addEventListener("mouseup", releaseButton);
    window.addEventListener("keydown", captureOnMove);
    document.addEventListener("mousemove", look);
    return () => {
      canvas.removeEventListener("mousedown", pressButton);
      canvas.removeEventListener("click", click);
      canvas.removeEventListener("contextmenu", blockMenu);
      canvas.removeEventListener("mouseleave", forgetCursor);
      canvas.removeEventListener("wheel", zoom);
      window.removeEventListener("mouseup", releaseButton);
      window.removeEventListener("keydown", captureOnMove);
      document.removeEventListener("mousemove", look);
    };
  }, [gl, camera, mode, player, onRead, orbit, isPaused, cursorRaycaster]);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }
    camera.fov = BASE_FOV[mode];
    camera.updateProjectionMatrix();
    return () => {
      camera.fov = DEFAULT_FOV;
      camera.updateProjectionMatrix();
    };
  }, [camera, mode]);

  useEffect(() => () => onNearby(null), [onNearby]);

  // A wizard who lands inside a cauldron's footprint after flying may still walk out of it.
  const blocked = (fromX: number, fromZ: number, x: number, z: number) =>
    x < walkBounds.minX ||
    x > walkBounds.maxX ||
    z < walkBounds.minZ ||
    z > walkBounds.maxZ ||
    solids.some((rect) => isInside(x, z, rect) && !isInside(fromX, fromZ, rect));

  const moveFlying = (state: Player, forward: number, strafe: number, vertical: number, sprint: boolean, delta: number) => {
    const sinYaw = Math.sin(state.yaw);
    const cosYaw = Math.cos(state.yaw);
    const cosPitch = Math.cos(state.pitch);
    const lookVertical = mode === "third" ? 0 : Math.sin(state.pitch);
    const lookHorizontal = mode === "third" ? 1 : cosPitch;
    const wish = new THREE.Vector3(
      sinYaw * lookHorizontal * forward - cosYaw * strafe,
      lookVertical * forward + vertical,
      cosYaw * lookHorizontal * forward + sinYaw * strafe,
    );
    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(FLY_SPEED * (sprint ? FLY_SPRINT_MULTIPLIER : 1));
    }
    const response = Math.min(1, delta * FLY_ACCELERATION);
    state.velocityX += (wish.x - state.velocityX) * response;
    state.verticalSpeed += (wish.y - state.verticalSpeed) * response;
    state.velocityZ += (wish.z - state.velocityZ) * response;
    const nextX = THREE.MathUtils.clamp(state.x + state.velocityX * delta, walkBounds.minX, walkBounds.maxX);
    const nextY = THREE.MathUtils.clamp(state.y + state.verticalSpeed * delta, 0, highestFlight());
    const nextZ = THREE.MathUtils.clamp(state.z + state.velocityZ * delta, walkBounds.minZ, walkBounds.maxZ);
    state.velocityX = nextX === state.x + state.velocityX * delta ? state.velocityX : 0;
    state.verticalSpeed = nextY === state.y + state.verticalSpeed * delta ? state.verticalSpeed : 0;
    state.velocityZ = nextZ === state.z + state.velocityZ * delta ? state.velocityZ : 0;
    Object.assign(state, { x: nextX, y: nextY, z: nextZ });
    state.moving = Math.hypot(state.velocityX, state.verticalSpeed, state.velocityZ) > MOVING_THRESHOLD;
  };

  const moveWalking = (state: Player, forward: number, strafe: number, running: boolean, delta: number) => {
    const travel = travelDirection(state.yaw, forward, strafe);
    const speed = running ? RUN_SPEED : WALK_SPEED;
    const wishX = travel ? travel.x * speed : 0;
    const wishZ = travel ? travel.z * speed : 0;
    const grounded = state.y <= 0;
    const rate = (travel ? WALK_ACCELERATION : WALK_BRAKING) * (grounded ? 1 : AIR_CONTROL);
    const response = Math.min(1, delta * rate);
    state.velocityX += (wishX - state.velocityX) * response;
    state.velocityZ += (wishZ - state.velocityZ) * response;
    const stepX = state.velocityX * delta;
    const stepZ = state.velocityZ * delta;
    if (blocked(state.x, state.z, state.x + stepX, state.z)) {
      state.velocityX = 0;
    } else {
      state.x += stepX;
    }
    if (blocked(state.x, state.z, state.x, state.z + stepZ)) {
      state.velocityZ = 0;
    } else {
      state.z += stepZ;
    }
    const groundSpeed = Math.hypot(state.velocityX, state.velocityZ);
    state.moving = groundSpeed > MOVING_THRESHOLD;
    if (grounded) {
      state.stride += strideRate(groundSpeed) * delta;
    }
    if (grounded && jumpRequested.current) {
      state.verticalSpeed = JUMP_SPEED;
    }
    state.verticalSpeed -= GRAVITY * delta;
    state.y = Math.max(0, state.y + state.verticalSpeed * delta);
    if (state.y === 0) {
      state.verticalSpeed = 0;
    }
  };

  // Third person turns the wizard toward where it travels, as action games do, and backpedals when backing up; first
  // person always faces the view.
  const turnBody = (state: Player, forward: number, strafe: number, delta: number) => {
    if (mode === "first") {
      state.facing = state.yaw;
      return;
    }
    const target = facingForTravel(state.yaw, forward, strafe);
    if (target !== null) {
      state.facing = turnToward(state.facing, target, delta * TURN_TOWARD_TRAVEL);
    }
  };

  const swingCameraBehind = (state: Player, forward: number, delta: number) => {
    const now = performance.now();
    const offset = shortestTurn(state.yaw, state.facing);
    const headingForward = state.moving && forward > 0 && Math.abs(offset) <= RECENTER_WITHIN;
    headingForwardSince.current = headingForward ? (headingForwardSince.current ?? now) : null;
    const settled = headingForwardSince.current !== null && now - headingForwardSince.current > RECENTER_AFTER_FORWARD_MS;
    const lookedRecently = now - lookedAt.current < RECENTER_AFTER_LOOK_MS;
    if (mode !== "third" || !getPlayerSettings().recenterCamera || !settled || lookedRecently) {
      return;
    }
    turnView(state, recenterYaw(offset, delta), (RECENTER_PITCH - state.pitch) * Math.min(1, delta * RECENTER_PITCH_RATE), mode);
  };

  const placeCamera = (state: Player, delta: number) => {
    if (mode === "first") {
      camera.position.copy(firstPersonEye(state, headBob(state, getPlayerSettings().headBob)));
      camera.rotation.set(state.pitch, state.yaw + Math.PI, 0, "YXZ");
    } else {
      orbit.place(camera, state, getPlayerSettings().cameraDistance, viewBox, [...cauldrons, ...blockerBoxes()], delta);
    }
    camera.updateMatrixWorld();
  };

  const widenFovWithSpeed = (state: Player, delta: number) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }
    const next = camera.fov + (targetFov(mode, state) - camera.fov) * Math.min(1, delta * FOV_EASE);
    if (Math.abs(next - camera.fov) > FOV_EPSILON) {
      camera.fov = next;
      camera.updateProjectionMatrix();
    }
  };

  // Without pointer lock a dragged cursor stops at the screen edge, so holding it there keeps the view turning.
  const turnAtScreenEdge = (state: Player, delta: number) => {
    const at = pointer.current;
    if (!at || document.pointerLockElement || isPaused()) {
      return;
    }
    const pitchDirection = getPlayerSettings().invertY ? 1 : -1;
    turnView(state, -edgePush(at.x) * EDGE_TURN_SPEED * delta, edgePush(at.y) * EDGE_PITCH_SPEED * delta * pitchDirection, mode);
    if (edgePush(at.x) !== 0 || edgePush(at.y) !== 0) {
      lookedAt.current = performance.now();
    }
  };

  // The crosshair picks the PR, as in Minecraft: the first wizard or cauldron under the screen centre, within reach.
  const aimCrosshair = (state: Player) => {
    aimFrame.current = (aimFrame.current + 1) % AIM_EVERY_FRAMES;
    if (aimFrame.current !== 0) {
      return;
    }
    raycaster.setFromCamera(SCREEN_CENTER, camera);
    raycaster.far = READ_REACH + camera.position.distanceTo(new THREE.Vector3(state.x, camera.position.y, state.z));
    const hit = raycaster.intersectObjects([...pullRequestTargets], true)[0];
    const next = hit ? findTargetId(hit.object) : null;
    aimed.current = next;
    if (next !== nearby.current) {
      nearby.current = next;
      onNearby(next);
    }
  };

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const state = player.current;
    const paused = isPaused();
    const keys = paused ? NO_KEYS : held.current;
    state.x = THREE.MathUtils.clamp(state.x, walkBounds.minX, walkBounds.maxX);
    state.z = THREE.MathUtils.clamp(state.z, walkBounds.minZ, walkBounds.maxZ);
    const forward = axis(keys, MOVE_KEYS.forward, MOVE_KEYS.back);
    const strafe = axis(keys, MOVE_KEYS.right, MOVE_KEYS.left);
    const sprint = sprinting.current && !paused;
    if (paused) {
      jumpRequested.current = false;
    } else {
      turnAtScreenEdge(state, delta);
    }
    if (state.flying) {
      moveFlying(state, forward, strafe, axis(keys, MOVE_KEYS.up, MOVE_KEYS.down), sprint, delta);
    } else {
      moveWalking(state, forward, strafe, sprint, delta);
    }
    jumpRequested.current = false;
    turnBody(state, forward, strafe, delta);
    swingCameraBehind(state, forward, delta);
    placeCamera(state, delta);
    widenFovWithSpeed(state, delta);
    aimCrosshair(state);
  }, CAMERA_FRAME_PRIORITY);

  return mode === "first" ? <FirstPersonWand player={player} /> : <Avatar player={player} />;
}
