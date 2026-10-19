import { useSyncExternalStore } from "react";

let open = false;
let openedAt = 0;
const listeners = new Set<() => void>();

// Some browsers deliver the Esc keydown that also ended pointer lock; it must not close the menu the unlock just opened.
const SAME_PRESS_MS = 250;

function set(next: boolean) {
  if (next === open) {
    return;
  }
  open = next;
  openedAt = next ? performance.now() : openedAt;
  for (const listener of listeners) {
    listener();
  }
}

export function openSettings() {
  set(true);
}

export function closeSettings() {
  set(false);
}

export function toggleSettingsFromEscape() {
  if (open && performance.now() - openedAt < SAME_PRESS_MS) {
    return;
  }
  set(!open);
}

export function isSettingsOpen() {
  return open;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettingsOpen() {
  return useSyncExternalStore(subscribe, () => open);
}
