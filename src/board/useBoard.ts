import { useCallback, useEffect, useRef, useState } from "react";
import { type Board, type BoardEvent, type PollStatus, type PullRequest, boardSchema, pollStatusSchema } from "../../shared/board";
import { buildDemoSteps, findRestoreEvents } from "./demo";

export type FreshBatch = { id: number; events: BoardEvent[]; previous: PullRequest[] };

const DEMO_STEP_MS = 2600;
// Long enough for the last step's departure to finish walking out before the real board comes back.
const DEMO_SETTLE_MS = 5000;

export function useBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [status, setStatus] = useState<PollStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [fresh, setFresh] = useState<FreshBatch>({ id: 0, events: [], previous: [] });
  const seenEventIds = useRef<Set<string> | null>(null);
  const boardRef = useRef<Board | null>(null);
  const polledBoard = useRef<Board | null>(null);
  const heldEvents = useRef<BoardEvent[]>([]);
  const demoTimers = useRef<number[]>([]);

  const ingest = useCallback((next: Board, events: BoardEvent[]) => {
    if (events.length > 0) {
      setFresh((batch) => ({ id: batch.id + 1, events, previous: boardRef.current?.pullRequests ?? [] }));
    }
    boardRef.current = next;
    setBoard(next);
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/stream");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener("board", (message) => {
      const next = boardSchema.parse(JSON.parse(message.data));
      const seen = seenEventIds.current;
      const events = seen ? next.events.filter((event) => !seen.has(event.id)) : [];
      seenEventIds.current = new Set(next.events.map((event) => event.id));
      polledBoard.current = next;
      if (demoTimers.current.length > 0) {
        heldEvents.current.push(...events);
        return;
      }
      ingest(next, events);
    });
    source.addEventListener("status", (message) => {
      setStatus(pollStatusSchema.parse(JSON.parse(message.data)));
    });
    return () => source.close();
  }, [ingest]);

  useEffect(() => {
    return () => {
      for (const timer of demoTimers.current) {
        clearTimeout(timer);
      }
    };
  }, []);

  const refresh = useCallback(() => {
    void fetch("/api/refresh", { method: "POST" });
  }, []);

  // Plays a scripted run of fake changes on this screen only. Polls are held until it ends, then the real board comes back.
  const playDemo = useCallback(() => {
    if (demoTimers.current.length > 0) {
      return;
    }
    const steps = buildDemoSteps(boardRef.current?.viewer ?? "you");
    const stepTimers = steps.map((step, index) =>
      window.setTimeout(() => {
        const current = boardRef.current;
        const result = current ? step(current) : null;
        if (result) {
          ingest(result.board, [result.event]);
        }
      }, index * DEMO_STEP_MS),
    );
    const endTimer = window.setTimeout(
      () => {
        demoTimers.current = [];
        const real = polledBoard.current;
        const demo = boardRef.current;
        const held = heldEvents.current;
        if (real && demo) {
          const restored = findRestoreEvents(demo, real).filter((event) => !held.some((heldEvent) => heldEvent.number === event.number));
          ingest(real, [...restored, ...held]);
        }
        heldEvents.current = [];
      },
      (steps.length - 1) * DEMO_STEP_MS + DEMO_SETTLE_MS,
    );
    demoTimers.current = [...stepTimers, endTimer];
  }, [ingest]);

  return { board, status, connected, fresh, refresh, playDemo };
}
