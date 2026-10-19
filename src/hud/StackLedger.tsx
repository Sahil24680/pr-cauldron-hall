import { motion } from "motion/react";
import { type KeyboardEvent, useEffect, useRef } from "react";
import type { PullRequest, Stage } from "../../shared/board";
import { type CiState, daysSinceUpdate, findCiState, isStale, putStaleFirst } from "../../shared/stage";
import { STAGE_THEMES } from "../lib/theme";
import { stripTicketPrefix } from "../lib/title";
import { describeAgo } from "../lib/useNow";

type Props = { stage: Stage; pullRequests: PullRequest[]; now: number; selected: number | null; onPick: (number: number) => void; onClose: () => void };

const CI_LABELS: Record<CiState, { tone: string; text: string }> = {
  failing: { tone: "bad", text: "Failing" },
  running: { tone: "busy", text: "Running" },
  passing: { tone: "good", text: "Passing" },
  none: { tone: "none", text: "No checks" },
};

const ROW_MOVES: Record<string, (index: number, count: number) => number> = {
  ArrowDown: (index, count) => Math.min(count - 1, index + 1),
  ArrowUp: (index) => Math.max(0, index - 1),
  Home: () => 0,
  End: (_, count) => count - 1,
};

export function StackLedger({ stage, pullRequests, now, selected, onPick, onClose }: Props) {
  const theme = STAGE_THEMES[stage];
  const list = useRef<HTMLOListElement>(null);
  const lastPicked = useRef<number | null>(null);
  const reading = selected !== null;
  const rows = putStaleFirst(pullRequests, now);
  const staleCount = rows.filter((pr) => isStale(pr, now)).length;

  // Narrow screens hide the ledger behind the detail card, so focus comes back to the last row read once the card closes.
  useEffect(() => {
    if (reading) {
      return;
    }
    const rows = list.current;
    (rows?.querySelector<HTMLButtonElement>(`[data-number="${lastPicked.current}"]`) ?? rows?.querySelector<HTMLButtonElement>("button"))?.focus();
  }, [reading]);

  const pick = (number: number) => {
    lastPicked.current = number;
    onPick(number);
  };

  const moveFocus = (event: KeyboardEvent<HTMLOListElement>) => {
    const move = ROW_MOVES[event.key];
    const rows = [...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    if (!move || rows.length === 0) {
      return;
    }
    event.preventDefault();
    const current = rows.findIndex((row) => row === document.activeElement);
    rows[move(Math.max(0, current), rows.length)]?.focus();
  };

  return (
    <motion.section
      className={`parchment stack-ledger${reading ? " reading" : ""}`}
      aria-label={`${theme.plain} ledger`}
      initial={{ opacity: 0, x: -30, rotate: 1.5, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
    >
      <button type="button" className="parchment-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <p className="parchment-stage" style={{ color: theme.banner }}>
        {theme.plain}
      </p>
      <h2 className="parchment-title">The Headmaster's ledger</h2>
      <p className="parchment-meta">
        {pullRequests.length} pull requests{staleCount > 0 ? `, ${staleCount} gone quiet and listed first` : ""}. <kbd>↑</kbd> <kbd>↓</kbd> to move,{" "}
        <kbd>Enter</kbd> to read, <kbd>Esc</kbd> to close.
      </p>
      <ol ref={list} className="ledger-rows" onKeyDown={moveFocus}>
        {rows.map((pr) => {
          const ci = CI_LABELS[findCiState(pr)];
          const stale = isStale(pr, now);
          return (
            <li key={pr.number}>
              <button
                type="button"
                className="ledger-row"
                data-number={pr.number}
                aria-current={pr.number === selected ? "true" : undefined}
                onClick={() => pick(pr.number)}
              >
                <span className="mono ledger-number">#{pr.number}</span>
                <span className="ledger-title">
                  {stale && <span className="ledger-stale">Quiet {Math.floor(daysSinceUpdate(pr, now))} days</span>}
                  {stripTicketPrefix(pr.title)}
                </span>
                <span className="ledger-meta">
                  {pr.authorName} · <span className={`ci-${ci.tone}`}>{ci.text}</span> · opened {describeAgo(pr.createdAt, now)} ago
                  {pr.mergeable === "CONFLICTING" ? " · in chains" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </motion.section>
  );
}
