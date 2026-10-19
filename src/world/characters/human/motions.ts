export type HumanMotion =
  | "idle"
  | "brew"
  | "stir"
  | "cast"
  | "walk"
  | "jog"
  | "sprint"
  | "jump"
  | "airborne"
  | "land"
  | "ride"
  | "levitate"
  | "lecture"
  | "holdStaff";

// `pace` is the ground speed (m/s, before HUMAN_SCALE) at which the clip's feet do not slide. Casting clips gesture
// with an open hand, so there the wand is aimed along the forearm ("point") instead of across the fist. `stirs` circles
// the wand hand over the pot on top of a calm stance, since the library has no brewing clip.
type MotionClip = { clip: string; loop: boolean; pace?: number; wandAim?: "point"; stirs?: true };

export const MOTION_CLIPS: Record<HumanMotion, MotionClip> = {
  idle: { clip: "Idle_Loop", loop: true },
  brew: { clip: "Spell_Simple_Idle_Loop", loop: true, wandAim: "point" },
  stir: { clip: "Idle_Loop", loop: true, wandAim: "point", stirs: true },
  cast: { clip: "Spell_Simple_Shoot", loop: false, wandAim: "point" },
  walk: { clip: "Walk_Loop", loop: true, pace: 0.97 },
  jog: { clip: "Jog_Fwd_Loop", loop: true, pace: 3.4 },
  sprint: { clip: "Sprint_Loop", loop: true, pace: 5.2 },
  jump: { clip: "Jump_Start", loop: false },
  airborne: { clip: "Jump_Loop", loop: true },
  land: { clip: "Jump_Land", loop: false },
  ride: { clip: "Sitting_Idle_Loop", loop: true },
  levitate: { clip: "Jump_Loop", loop: true },
  lecture: { clip: "Idle_Talking_Loop", loop: true },
  holdStaff: { clip: "Idle_Torch_Loop", loop: true },
};

export const CROSSFADE_SECONDS = 0.25;
