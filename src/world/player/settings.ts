import { useSyncExternalStore } from "react";
import { z } from "zod";

export const SENSITIVITY_RANGE = { min: 0.2, max: 3, step: 0.05 };
export const CAMERA_DISTANCE_RANGE = { min: 1.6, max: 7, step: 0.1 };
const STORAGE_KEY = "great-hall.player-settings";

const DEFAULT_SETTINGS = { sensitivity: 1, invertY: false, headBob: true, cameraDistance: 4.2, recenterCamera: true };
const settingsSchema = z
  .object({
    sensitivity: z.number().min(SENSITIVITY_RANGE.min).max(SENSITIVITY_RANGE.max).catch(DEFAULT_SETTINGS.sensitivity),
    invertY: z.boolean().catch(DEFAULT_SETTINGS.invertY),
    headBob: z.boolean().catch(DEFAULT_SETTINGS.headBob),
    cameraDistance: z.number().min(CAMERA_DISTANCE_RANGE.min).max(CAMERA_DISTANCE_RANGE.max).catch(DEFAULT_SETTINGS.cameraDistance),
    recenterCamera: z.boolean().catch(DEFAULT_SETTINGS.recenterCamera),
  })
  .catch(DEFAULT_SETTINGS);

export type PlayerSettings = z.infer<typeof settingsSchema>;

export function parseSettings(stored: unknown): PlayerSettings {
  return settingsSchema.parse(stored);
}

function readStored(): unknown {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
let settings = parseSettings(readStored());

export function getPlayerSettings() {
  return settings;
}

export function updatePlayerSettings(change: Partial<PlayerSettings>) {
  settings = parseSettings({ ...settings, ...change });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private windows can refuse storage; the change still applies until the page reloads.
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePlayerSettings() {
  return useSyncExternalStore(subscribe, getPlayerSettings);
}
