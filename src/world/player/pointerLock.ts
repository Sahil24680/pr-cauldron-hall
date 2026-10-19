import { useSyncExternalStore } from "react";

export type PointerLockState = { locked: boolean; unsupported: boolean };

let state: PointerLockState = { locked: false, unsupported: false };
let canvas: HTMLCanvasElement | null = null;
let releasedByGame = false;
let everLocked = false;
const listeners = new Set<() => void>();
const escapeListeners = new Set<() => void>();

function update(next: Partial<PointerLockState>) {
  state = { ...state, ...next };
  for (const listener of listeners) {
    listener();
  }
}

// The browser ends pointer lock itself when Esc is pressed and swallows that keypress, so an unlock the game did not ask
// for is how Esc is heard while playing.
document.addEventListener("pointerlockchange", () => {
  const wasLocked = state.locked;
  update({ locked: document.pointerLockElement !== null && document.pointerLockElement === canvas });
  everLocked = everLocked || state.locked;
  if (wasLocked && !state.locked && !releasedByGame) {
    for (const listener of escapeListeners) {
      listener();
    }
  }
  releasedByGame = false;
});
// Chrome refuses a relock for about a second after Esc, and one without a click; neither means lock is unavailable.
function markUnsupportedIfNeverLocked() {
  if (!everLocked) {
    update({ unsupported: true });
  }
}

document.addEventListener("pointerlockerror", markUnsupportedIfNeverLocked);

export function registerLockTarget(element: HTMLCanvasElement | null) {
  canvas = element;
}

// Embedded previews refuse pointer lock; the game then falls back to looking around with the visible cursor.
export function requestLock() {
  if (!canvas || document.pointerLockElement === canvas) {
    return;
  }
  Promise.resolve(canvas.requestPointerLock?.()).catch(markUnsupportedIfNeverLocked);
}

export function releaseLock() {
  if (document.pointerLockElement) {
    releasedByGame = true;
    document.exitPointerLock();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onEscapeUnlock(listener: () => void) {
  escapeListeners.add(listener);
  return () => {
    escapeListeners.delete(listener);
  };
}

export function usePointerLock() {
  return useSyncExternalStore(subscribe, () => state);
}
