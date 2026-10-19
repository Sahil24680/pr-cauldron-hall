import type { ReactNode } from "react";
import type { LabelSize, SafeArea } from "./placeLabel";

export type LabelEntry = { id: string; content: ReactNode };

let entries: LabelEntry[] = [];
let safeArea: SafeArea | null = null;
let nextId = 0;
const listeners = new Set<() => void>();
const elements = new Map<string, HTMLElement>();
const sizes = new WeakMap<Element, LabelSize>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function createLabelId() {
  nextId += 1;
  return `label-${nextId}`;
}

export function showLabel(id: string, content: ReactNode) {
  const shown = entries.some((entry) => entry.id === id);
  entries = shown ? entries.map((entry) => (entry.id === id ? { id, content } : entry)) : [...entries, { id, content }];
  notify();
}

export function hideLabel(id: string) {
  entries = entries.filter((entry) => entry.id !== id);
  notify();
}

export function subscribeLabels(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readLabels() {
  return entries;
}

export function attachLabelElement(id: string, element: HTMLElement) {
  elements.set(id, element);
}

export function detachLabelElement(id: string) {
  elements.delete(id);
}

export function measureLabelElements(observed: ResizeObserverEntry[]) {
  for (const { target } of observed) {
    if (target instanceof HTMLElement) {
      sizes.set(target, { width: target.offsetWidth, height: target.offsetHeight });
    }
  }
}

export function findLabelElement(id: string) {
  const element = elements.get(id);
  const size = element && sizes.get(element);
  return element && size ? { element, size } : null;
}

export function setSafeArea(rect: DOMRect) {
  safeArea = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

export function readSafeArea() {
  return safeArea;
}
