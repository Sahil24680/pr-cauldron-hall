import { FRONT_CORRIDOR_Z } from "../layout";

export type ViewMode = "third" | "first";
export type Player = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  facing: number;
  velocityX: number;
  velocityZ: number;
  verticalSpeed: number;
  stride: number;
  flying: boolean;
  moving: boolean;
};

export function startingPlayer(): Player {
  return {
    x: 0,
    y: 0,
    z: FRONT_CORRIDOR_Z + 1,
    yaw: Math.PI,
    pitch: 0,
    facing: Math.PI,
    velocityX: 0,
    velocityZ: 0,
    verticalSpeed: 0,
    stride: 0,
    flying: false,
    moving: false,
  };
}
