import { useSyncExternalStore } from "react";
import { type Appearance, type Cast, type CastKey, DEFAULT_CAST, appearanceSchema, fitToBuild, mergeCast } from "../../shared/cast";

// Edits show at once and are saved shortly after the last change, so dragging a colour picker is one write, not fifty.
const SAVE_DELAY_MS = 400;

let cast: Cast = DEFAULT_CAST;
const listeners = new Set<() => void>();
const pendingSaves = new Map<CastKey, ReturnType<typeof setTimeout>>();

function publish(next: Cast) {
  cast = next;
  for (const listener of listeners) {
    listener();
  }
}

async function loadCast() {
  const response = await fetch("/api/cast").catch(() => null);
  if (response?.ok) {
    publish(mergeCast(await response.json()));
  }
}

function save(key: CastKey) {
  clearTimeout(pendingSaves.get(key));
  pendingSaves.set(
    key,
    setTimeout(() => {
      pendingSaves.delete(key);
      void fetch(`/api/cast/${key}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cast[key]) });
    }, SAVE_DELAY_MS),
  );
}

export function updateCastMember(key: CastKey, change: Partial<Appearance>) {
  const next = appearanceSchema.safeParse({ ...cast[key], ...change });
  if (!next.success) {
    return;
  }
  publish({ ...cast, [key]: fitToBuild(next.data) });
  save(key);
}

// The server puts back the member as last committed and answers with it; without a server (a static deploy) the
// committed cast is the one this bundle was built with.
export async function resetCastMember(key: CastKey) {
  clearTimeout(pendingSaves.get(key));
  pendingSaves.delete(key);
  const response = await fetch(`/api/cast/${key}/reset`, { method: "POST" }).catch(() => null);
  const committed = response?.ok ? mergeCast(await response.json())[key] : DEFAULT_CAST[key];
  publish({ ...cast, [key]: committed });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCast() {
  return useSyncExternalStore(subscribe, () => cast);
}

export function useCastMember(key: CastKey) {
  return useSyncExternalStore(subscribe, () => cast[key]);
}

void loadCast();
