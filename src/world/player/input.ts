import { useEffect, useRef } from "react";

export const DOUBLE_TAP_MS = 300;

export const MOVE_KEYS = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  up: ["Space"],
  down: ["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "KeyC"],
};
export const VIEW_TOGGLE_KEYS = ["KeyV", "F5"];
const META_KEYS = ["MetaLeft", "MetaRight"];

export function isTyping(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

export function useKeyboard(onDoubleSpace: () => void) {
  const held = useRef(new Set<string>());
  const jumpRequested = useRef(false);
  const lastSpaceAt = useRef(0);
  const sprinting = useRef(false);
  const lastForwardAt = useRef(0);
  useEffect(() => {
    const clear = () => {
      held.current.clear();
      sprinting.current = false;
    };
    const down = (event: KeyboardEvent) => {
      // macOS sends no keyup for keys released while Cmd is down, so they would stay held forever.
      if (isTyping(event.target) || event.metaKey) {
        return;
      }
      if (event.code === "F5") {
        event.preventDefault();
      }
      held.current.add(event.code);
      if (MOVE_KEYS.forward.includes(event.code) && !event.repeat) {
        const now = performance.now();
        sprinting.current = now - lastForwardAt.current < DOUBLE_TAP_MS;
        lastForwardAt.current = now;
      }
      if (event.code !== "Space" || event.ctrlKey) {
        return;
      }
      event.preventDefault();
      if (event.repeat) {
        return;
      }
      jumpRequested.current = true;
      const now = performance.now();
      if (now - lastSpaceAt.current < DOUBLE_TAP_MS) {
        lastSpaceAt.current = 0;
        onDoubleSpace();
        return;
      }
      lastSpaceAt.current = now;
    };
    const up = (event: KeyboardEvent) => {
      if (META_KEYS.includes(event.code)) {
        clear();
        return;
      }
      held.current.delete(event.code);
      if (!MOVE_KEYS.forward.some((code) => held.current.has(code))) {
        sprinting.current = false;
      }
    };
    const clearWhenHidden = () => {
      if (document.hidden) {
        clear();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clearWhenHidden);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clearWhenHidden);
    };
  }, [onDoubleSpace]);
  return { held, jumpRequested, sprinting };
}

export function axis(held: Set<string>, positive: string[], negative: string[]) {
  return (positive.some((code) => held.has(code)) ? 1 : 0) - (negative.some((code) => held.has(code)) ? 1 : 0);
}
