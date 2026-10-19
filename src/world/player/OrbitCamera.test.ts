import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { hallBounds } from "../layout";
import { OrbitCamera } from "./OrbitCamera";
import { cameraBox, highestFlight } from "./camera";
import { PIVOT_HEIGHT } from "./orbit";
import { type Player, startingPlayer } from "./player";

const hall = cameraBox(hallBounds(-20, 0.6));
const ZOOM = 4;
// A pillar square behind the shoulder, which sits 0.45 m to the wizard's right (-X when facing +Z).
const PILLAR_BEHIND = new THREE.Box3(new THREE.Vector3(-1, 0, -1.6), new THREE.Vector3(0.1, 3, -1.3));

function placedCamera(at: Partial<Player>, solids: THREE.Box3[] = []) {
  const camera = new THREE.PerspectiveCamera();
  const player = { ...startingPlayer(), x: 0, y: 0, z: 0, yaw: 0, pitch: 0, ...at };
  new OrbitCamera().place(camera, player, ZOOM, hall, solids, 1 / 60);
  return { camera, looking: camera.getWorldDirection(new THREE.Vector3()), head: new THREE.Vector3(player.x, player.y + PIVOT_HEIGHT, player.z) };
}

describe("OrbitCamera", () => {
  it("hangs level at head height in open floor", () => {
    const { camera, looking } = placedCamera({});
    expect(camera.position.y).toBeCloseTo(PIVOT_HEIGHT);
    expect(looking.y).toBeCloseTo(0);
  });

  it("rises a little and still looks mostly ahead when backed against a wall", () => {
    const { camera, looking, head } = placedCamera({ z: hall.minZ + 0.6 });
    expect(camera.position.z).toBeGreaterThanOrEqual(hall.minZ);
    expect(camera.position.y).toBeGreaterThan(PIVOT_HEIGHT);
    expect(camera.position.y).toBeLessThan(head.y + 1);
    expect(looking.y).toBeLessThan(0);
    expect(looking.z).toBeGreaterThan(0.9);
  });

  it("moves over the left shoulder when the right one is against a wall", () => {
    const { camera } = placedCamera({ x: hall.minX + 0.1 });
    expect(camera.position.x).toBeGreaterThan(hall.minX + 0.1);
  });

  it("swings aside past a pillar square behind instead of closing in", () => {
    const { camera, looking, head } = placedCamera({}, [PILLAR_BEHIND]);
    expect(camera.position.distanceTo(head)).toBeGreaterThan(3);
    expect(looking.z).toBeGreaterThan(0.9);
  });

  it("levels the boom under the ceiling instead of closing in on the wizard's back", () => {
    const { camera, looking } = placedCamera({ y: highestFlight(), pitch: -0.3 });
    expect(-camera.position.z).toBeGreaterThan(3.5);
    expect(camera.position.y).toBeLessThanOrEqual(hall.maxY);
    expect(looking.y).toBeLessThan(0);
  });
});
