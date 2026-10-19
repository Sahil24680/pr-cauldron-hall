import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import type { PollStatus, PullRequest, Stage } from "../../shared/board";
import { useSettingsOpen } from "../lib/settingsMenu";
import { STAGE_THEMES } from "../lib/theme";
import { stripTicketPrefix } from "../lib/title";
import type { ViewMode } from "../world/player/player";
import { requestLock, usePointerLock } from "../world/player/pointerLock";

const OATH = "I solemnly swear that I am up to no good.";
const AIMING_CLASS = "first-person-aim";

export function Oath({ status, connected }: { status: PollStatus | null; connected: boolean }) {
  return (
    <motion.div className="oath" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }} transition={{ duration: 0.9 }}>
      <p className="oath-words" aria-label={OATH}>
        {OATH.split("").map((letter, index) => (
          <motion.span key={`${letter}-${index}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }}>
            {letter}
          </motion.span>
        ))}
      </p>
      <p className="oath-status">
        {status?.error ?? (connected ? "Sending owls to GitHub for every open PR…" : "Looking for the castle server on port 4848…")}
      </p>
    </motion.div>
  );
}

function PauseScreen() {
  return (
    <motion.div className="pause" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="pause-card">
        <h2>PR Cauldron Hall</h2>
        <button type="button" className="accio pause-enter" onClick={requestLock}>
          Play
        </button>
      </div>
    </motion.div>
  );
}

export type AimedTarget = { kind: "pr"; pr: PullRequest } | { kind: "stack"; stage: Stage };
type WalkOverlayProps = { aimed: AimedTarget | null; paused: boolean; mode: ViewMode };

function AimedAction({ aimed }: { aimed: AimedTarget }) {
  if (aimed.kind === "stack") {
    return <>Open the {STAGE_THEMES[aimed.stage].plain} ledger</>;
  }
  return (
    <>
      Read <span className="mono">#{aimed.pr.number}</span> {stripTicketPrefix(aimed.pr.title)}
    </>
  );
}

export function WalkOverlay({ aimed, paused, mode }: WalkOverlayProps) {
  const { locked, unsupported } = usePointerLock();
  const settingsOpen = useSettingsOpen();
  const walking = paused && (locked || unsupported);
  const aiming = mode === "first" && walking;

  useEffect(() => {
    document.body.classList.toggle(AIMING_CLASS, aiming);
    return () => document.body.classList.remove(AIMING_CLASS);
  }, [aiming]);

  return (
    <>
      {aiming && <div className="wand-crosshair" aria-hidden="true" />}
      {mode === "third" && walking && !settingsOpen && <div className={`aim-reticle${aimed ? " on-target" : ""}`} aria-hidden="true" />}
      <AnimatePresence>{paused && !locked && !unsupported && !settingsOpen && <PauseScreen />}</AnimatePresence>
      <AnimatePresence>
        {aimed && paused && !settingsOpen && (
          <motion.div className="walk-prompt" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <kbd>Click</kbd> or <kbd>E</kbd> <AimedAction aimed={aimed} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
