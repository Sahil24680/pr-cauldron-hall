import { useEffect, useState } from "react";
import type { BoardEvent } from "../../shared/board";
import type { FreshBatch } from "../board/useBoard";
import { useLatest } from "../lib/useLatest";
import type { DepartingWizard } from "./Scene";
import { type BurstKind, type BurstSpec, burstLifetimeMs } from "./effects/Burst";
import { DOOR, type Station, layoutHall } from "./layout";

const DEPARTURE_MS = 4500;
const ARRIVAL_MS = 10_000;

function burstKindFor(event: BoardEvent): BurstKind {
  if (event.kind === "merged") {
    return "fireworks";
  }
  if (event.kind === "ci-failed" || event.kind === "conflict" || event.to === "changes") {
    return "curse";
  }
  if (event.kind === "ci-passed" || event.to === "review") {
    return "charm";
  }
  if (event.to === "approved") {
    return "gold";
  }
  return "smoke";
}

// Turns each batch of fresh board events into short-lived world effects: bursts, wizards leaving, wizards arriving.
// A PR inside a Headmaster's stack has no wizard of its own, so its effects all burst at his grand cauldron.
export function useWorldEvents(fresh: FreshBatch, stations: Map<number, Station>) {
  const [departing, setDeparting] = useState<DepartingWizard[]>([]);
  const [bursts, setBursts] = useState<BurstSpec[]>([]);
  const [arrivals, setArrivals] = useState<Set<number>>(() => new Set());
  const latestStations = useLatest(stations);

  useEffect(() => {
    if (fresh.events.length === 0) {
      return;
    }
    const previousStations = layoutHall(fresh.previous).stations;
    const previousByNumber = new Map(fresh.previous.map((pr) => [pr.number, pr]));
    const newBursts: BurstSpec[] = [];
    const newDepartures: DepartingWizard[] = [];
    const newArrivals: number[] = [];

    for (const event of fresh.events) {
      const key = `${fresh.id}-${event.id}`;
      const leaving = event.kind === "merged" || event.kind === "closed";
      const station = leaving ? previousStations.get(event.number) : latestStations.current.get(event.number);
      const stacked = station?.stacked ?? false;
      const at = event.kind === "opened" && !stacked ? DOOR : station?.cauldron;
      if (at) {
        newBursts.push({ id: key, kind: burstKindFor(event), x: at.x, z: at.z });
      }
      const pr = previousByNumber.get(event.number);
      if (leaving && pr && station && !stacked) {
        newDepartures.push({ key, pr, station, departure: event.kind === "merged" ? "merged" : "closed" });
      }
      if (event.kind === "opened" && !stacked) {
        newArrivals.push(event.number);
      }
    }

    setBursts((current) => [...current, ...newBursts]);
    setDeparting((current) => [...current, ...newDepartures]);
    setArrivals((current) => new Set([...current, ...newArrivals]));

    for (const burst of newBursts) {
      setTimeout(() => setBursts((current) => current.filter((candidate) => candidate.id !== burst.id)), burstLifetimeMs(burst.kind));
    }
    setTimeout(() => setDeparting((current) => current.filter((wizard) => !newDepartures.includes(wizard))), DEPARTURE_MS);
    setTimeout(() => setArrivals((current) => new Set([...current].filter((number) => !newArrivals.includes(number)))), ARRIVAL_MS);
  }, [fresh, latestStations]);

  return { departing, bursts, arrivals };
}
