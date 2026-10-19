import * as THREE from "three";
import type { CameraBox } from "./camera";
import { PIVOT_HEIGHT, SHOULDER_OFFSET, clearDistance, shoulderPivot, viewForward, viewRight } from "./orbit";
import type { Player } from "./player";

type Boom = { swing: number; level: number };

const PIVOT_FOLLOW = 14;
const PIVOT_FOLLOW_VERTICAL = 7;
const BOOM_EASE_OUT = 3;
const BOOM_SWING_EASE = 4;
// Farther than this in one frame is a teleport (a picked PR, Home), so the camera cuts instead of sweeping across the hall.
const TELEPORT_DISTANCE = 6;
// The camera looks at a point this far ahead of the wizard, so a boom pushed aside, levelled or lifted still faces the way on.
const AIM_AHEAD = 6;
const BOOM_SWINGS = [0, 0.35, -0.35, 0.7, -0.7];
// Metres of boom given up per radian the boom turns away from straight behind, so a wall square behind does not set it swaying.
const SWING_COST = 0.5;
// The boom in use wins ties by this much, so the camera does not flick between two equally good sides.
const BOOM_STICKINESS = 0.2;
// Squeezed closer than this (backed into a wall), the camera widens the shoulder and rises a little.
const COMFORT_BOOM = 1.8;
const CRAMPED = { widenShoulder: 0.4, rise: 0.6 };
// The camera moves to the left shoulder only once it has this much more room there, so it does not hop between them.
const SHOULDER_SWAP_MARGIN = 0.2;
const SHOULDER_EASE = 6;
const UP = new THREE.Vector3(0, 1, 0);

const head = new THREE.Vector3();
const behind = new THREE.Vector3();
const direction = new THREE.Vector3();
const aim = new THREE.Vector3();

function boomDirection(player: Player, boom: Boom) {
  direction.copy(viewForward(player.yaw + boom.swing, player.pitch)).negate();
  direction.y *= 1 - boom.level;
  return direction.normalize();
}

// The follow camera of modern third-person games: the mouse orbits it, the pivot trails the wizard's head, and a wall
// behind it pulls it in at once and lets it ease back out once clear. Where the straight boom is blocked, it swings
// aside past the obstacle or, under the ceiling, levels out rather than closing in on the wizard's back.
export class OrbitCamera {
  private readonly pivot = new THREE.Vector3();
  private boom = 0;
  private cramped = 0;
  private shoulder = SHOULDER_OFFSET;
  private readonly easedBoom: Boom = { swing: 0, level: 0 };
  private chosenBoom: Boom = { swing: 0, level: 0 };
  private placed = false;

  reset() {
    this.placed = false;
  }

  private chooseBoom(player: Player, shoulder: THREE.Vector3, zoom: number, hall: CameraBox, solids: THREE.Box3[]) {
    behind.copy(viewForward(player.yaw, player.pitch)).negate();
    const levels = behind.y > 0 ? [0, 1] : [0];
    let best = this.chosenBoom;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const level of levels) {
      for (const swing of BOOM_SWINGS) {
        const boom = { swing, level };
        const along = boomDirection(player, boom);
        const sticky = swing === this.chosenBoom.swing && level === this.chosenBoom.level ? BOOM_STICKINESS : 0;
        const score = clearDistance(shoulder, along, zoom, hall, solids) - SWING_COST * along.angleTo(behind) + sticky;
        if (score > bestScore) {
          best = boom;
          bestScore = score;
        }
      }
    }
    return best;
  }

  private chooseShoulder(player: Player, hall: CameraBox, solids: THREE.Box3[]) {
    const wanted = SHOULDER_OFFSET + this.cramped * CRAMPED.widenShoulder;
    const right = viewRight(player.yaw);
    const roomRight = clearDistance(this.pivot, right, wanted, hall, solids);
    const roomLeft = clearDistance(this.pivot, right.negate(), wanted, hall, solids);
    const margin = this.shoulder > 0 ? SHOULDER_SWAP_MARGIN : -SHOULDER_SWAP_MARGIN;
    return roomLeft > roomRight + margin ? -roomLeft : roomRight;
  }

  place(camera: THREE.Camera, player: Player, zoom: number, hall: CameraBox, solids: THREE.Box3[], delta: number) {
    head.set(player.x, Math.min(player.y + PIVOT_HEIGHT, hall.maxY), player.z);
    const teleported = !this.placed || this.pivot.distanceTo(head) > TELEPORT_DISTANCE;
    if (teleported) {
      this.pivot.copy(head);
    } else {
      const sideways = Math.min(1, delta * PIVOT_FOLLOW);
      const vertical = Math.min(1, delta * PIVOT_FOLLOW_VERTICAL);
      this.pivot.set(
        THREE.MathUtils.lerp(this.pivot.x, head.x, sideways),
        THREE.MathUtils.lerp(this.pivot.y, head.y, vertical),
        THREE.MathUtils.lerp(this.pivot.z, head.z, sideways),
      );
    }
    const shoulderShare = teleported ? 1 : Math.min(1, delta * SHOULDER_EASE);
    this.shoulder += (this.chooseShoulder(player, hall, solids) - this.shoulder) * shoulderShare;
    const shoulder = shoulderPivot(this.pivot, player.yaw, hall, solids, this.shoulder);
    this.chosenBoom = this.chooseBoom(player, shoulder, zoom, hall, solids);
    const easeAside = teleported ? 1 : Math.min(1, delta * BOOM_SWING_EASE);
    this.easedBoom.swing += (this.chosenBoom.swing - this.easedBoom.swing) * easeAside;
    this.easedBoom.level += (this.chosenBoom.level - this.easedBoom.level) * easeAside;
    const along = boomDirection(player, this.easedBoom);
    const allowed = clearDistance(shoulder, along, zoom, hall, solids);
    const easeOut = Math.min(1, delta * BOOM_EASE_OUT);
    this.boom = teleported || allowed < this.boom ? allowed : THREE.MathUtils.lerp(this.boom, allowed, easeOut);
    this.cramped = Math.max(0, 1 - this.boom / COMFORT_BOOM);
    this.placed = true;

    camera.position.copy(shoulder).addScaledVector(along, this.boom);
    camera.position.y += clearDistance(camera.position, UP, this.cramped * CRAMPED.rise, hall, solids);
    camera.lookAt(aim.copy(shoulder).addScaledVector(viewForward(player.yaw, player.pitch), AIM_AHEAD));
  }
}
