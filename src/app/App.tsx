import { AnimatePresence, MotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PullRequest, Stage } from "../../shared/board";
import { useBoard } from "../board/useBoard";
import { DetailPanel } from "../hud/DetailPanel";
import { type AimedTarget, Oath, WalkOverlay } from "../hud/Overlays";
import { StackLedger } from "../hud/StackLedger";
import { TopBar } from "../hud/TopBar";
import { closeSettings, isSettingsOpen, openSettings, toggleSettingsFromEscape, useSettingsOpen } from "../lib/settingsMenu";
import { useNow } from "../lib/useNow";
import { type CameraFocus, Scene } from "../world/Scene";
import { LabelLayer } from "../world/labels/LabelLayer";
import { layoutHall } from "../world/layout";
import { VIEW_TOGGLE_KEYS } from "../world/player/input";
import type { ViewMode } from "../world/player/player";
import { onEscapeUnlock, releaseLock, requestLock } from "../world/player/pointerLock";
import { type Target, targetOf } from "../world/pullRequests/targets";
import { useWorldEvents } from "../world/useWorldEvents";
import { SceneErrorBoundary } from "./SceneErrorBoundary";

const CLOCK_TICK_MS = 15_000;
const NO_PULL_REQUESTS: PullRequest[] = [];
const STACK_DEMO_FLAG = "stackDemo";
const STACK_DEMO_COPIES = 6;
const STACK_DEMO_FIRST_NUMBER = 90_000;

// Preview aid: ?stackDemo adds draft copies of the first PR so the draft stage is crowded enough for its Headmaster.
function withStackDemo(pullRequests: PullRequest[]) {
  const template = pullRequests[0];
  if (!template || !new URLSearchParams(window.location.search).has(STACK_DEMO_FLAG)) {
    return pullRequests;
  }
  const copies = Array.from(
    { length: STACK_DEMO_COPIES },
    (_, index): PullRequest => ({
      ...template,
      number: STACK_DEMO_FIRST_NUMBER + index,
      title: `${template.title} (copy ${index + 1})`,
      isDraft: true,
      mergeable: index === 1 ? "CONFLICTING" : template.mergeable,
      checks: index === 2 ? { ...template.checks, failing: ["Unit Tests"] } : template.checks,
    }),
  );
  return [...pullRequests, ...copies];
}

function findAimed(target: Target | null, pullRequests: PullRequest[]): AimedTarget | null {
  if (target?.kind === "stack") {
    return target;
  }
  const pr = target && pullRequests.find((candidate) => candidate.number === target.number);
  return pr ? { kind: "pr", pr } : null;
}

export function App() {
  const { board, status, connected, fresh, refresh, playDemo } = useBoard();
  const now = useNow(CLOCK_TICK_MS);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focus, setFocus] = useState<CameraFocus>({ id: 0, target: { kind: "home" } });
  const [mode, setMode] = useState<ViewMode>("third");
  const [nearby, setNearby] = useState<number | null>(null);
  const [ledger, setLedger] = useState<Stage | null>(null);

  const pullRequests = useMemo(() => withStackDemo(board?.pullRequests ?? NO_PULL_REQUESTS), [board]);
  const { stations, stacks } = useMemo(() => layoutHall(pullRequests), [pullRequests]);
  const { departing, bursts, arrivals } = useWorldEvents(fresh, stations);
  const aimed = findAimed(nearby === null ? null : targetOf(nearby), pullRequests);
  const selectedPr = pullRequests.find((pr) => pr.number === selected) ?? null;
  const ledgerStack = ledger === null ? undefined : stacks.get(ledger);

  const focusOn = useCallback((target: CameraFocus["target"]) => setFocus((current) => ({ id: current.id + 1, target })), []);
  const pickPullRequest = useCallback(
    (number: number | null) => {
      setSelected(number);
      if (number !== null) {
        focusOn({ kind: "pr", number });
      }
    },
    [focusOn],
  );
  const pickZone = useCallback((stage: Stage) => focusOn({ kind: "zone", stage }), [focusOn]);
  const readTarget = useCallback((id: number) => {
    if (isSettingsOpen()) {
      return;
    }
    const target = targetOf(id);
    if (target?.kind === "pr") {
      setSelected(target.number);
    }
    if (target?.kind === "stack") {
      setLedger(target.stage);
    }
  }, []);

  useEffect(() => {
    if (selected !== null || ledger !== null) {
      releaseLock();
    }
  }, [selected, ledger]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (isSettingsOpen() || (selected === null && ledger === null))) {
        toggleSettingsFromEscape();
      } else if (event.key === "Escape" && selected !== null) {
        setSelected(null);
      } else if (event.key === "Escape") {
        setLedger(null);
      }
      if (event.target instanceof HTMLInputElement) {
        return;
      }
      const aimed = nearby === null || isSettingsOpen() ? null : targetOf(nearby);
      if (event.code === "KeyE" && aimed?.kind === "pr") {
        setSelected((current) => (current === aimed.number ? null : aimed.number));
      }
      if (event.code === "KeyE" && aimed?.kind === "stack") {
        setLedger((current) => (current === aimed.stage ? null : aimed.stage));
      }
      if (VIEW_TOGGLE_KEYS.includes(event.code)) {
        setMode(mode === "third" ? "first" : "third");
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [nearby, mode, selected, ledger]);

  useEffect(() => onEscapeUnlock(openSettings), []);

  const settingsOpen = useSettingsOpen();
  const settingsWereOpen = useRef(settingsOpen);
  useEffect(() => {
    if (settingsWereOpen.current && !settingsOpen && selected === null && ledger === null) {
      requestLock();
    }
    settingsWereOpen.current = settingsOpen;
  }, [settingsOpen, selected, ledger]);

  useEffect(() => {
    if (selected !== null || ledger !== null) {
      closeSettings();
    }
  }, [selected, ledger]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <div className="stage">
          {board && (
            <SceneErrorBoundary>
              <Scene
                pullRequests={pullRequests}
                viewer={board.viewer}
                now={now}
                mode={mode}
                selected={selected}
                hovered={hovered}
                nearby={nearby}
                arrivals={arrivals}
                departing={departing}
                bursts={bursts}
                focus={focus}
                onSelect={pickPullRequest}
                onHover={setHovered}
                onNearby={setNearby}
                onRead={readTarget}
                onPickZone={pickZone}
                onOpenStack={setLedger}
              />
            </SceneErrorBoundary>
          )}
          <LabelLayer />
        </div>

        <div className="hud">
          <TopBar
            repo={board?.repo ?? "Loading…"}
            openCount={pullRequests.length}
            status={status}
            connected={connected}
            now={now}
            mode={mode}
            onModeChange={setMode}
            onRefresh={refresh}
            onHome={() => focusOn({ kind: "home" })}
            onPlayDemo={playDemo}
          />
          <AnimatePresence>
            {ledgerStack && (
              <StackLedger
                key={ledgerStack.stage}
                stage={ledgerStack.stage}
                pullRequests={ledgerStack.numbers.flatMap((number) => pullRequests.find((pr) => pr.number === number) ?? [])}
                now={now}
                selected={selectedPr?.number ?? null}
                onPick={setSelected}
                onClose={() => {
                  setLedger(null);
                  if (selected === null) {
                    requestLock();
                  }
                }}
              />
            )}
          </AnimatePresence>
          <div className="right-column">
            <AnimatePresence mode="wait">
              {selectedPr && (
                <DetailPanel
                  key={selectedPr.number}
                  pr={selectedPr}
                  now={now}
                  onClose={() => {
                    setSelected(null);
                    if (!ledgerStack) {
                      requestLock();
                    }
                  }}
                  onPick={pickPullRequest}
                  stacked={pullRequests.filter((pr) => pr.parent === selectedPr.number)}
                />
              )}
            </AnimatePresence>
          </div>
          <WalkOverlay aimed={aimed} paused={selectedPr === null && !ledgerStack} mode={mode} />
        </div>

        <AnimatePresence>{!board && <Oath status={status} connected={connected} />}</AnimatePresence>
      </div>
    </MotionConfig>
  );
}
