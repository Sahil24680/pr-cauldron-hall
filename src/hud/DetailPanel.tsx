import { motion } from "motion/react";
import type { ChangeSummary, PullRequest, ReviewState } from "../../shared/board";
import { MAX_CLASSIFIED_FILES } from "../../shared/changes";
import { MAX_ADDED_LINES, daysSinceUpdate, findCiState, findStage, isReadyToMerge, isStale } from "../../shared/stage";
import { STAGE_THEMES } from "../lib/theme";
import { stripTicketPrefix } from "../lib/title";
import { describeAgo } from "../lib/useNow";

type Props = { pr: PullRequest; now: number; onClose: () => void; onPick: (number: number) => void; stacked: PullRequest[] };

const REVIEW_LABELS: Record<ReviewState, string> = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "requested changes",
  COMMENTED: "commented",
  DISMISSED: "dismissed",
  PENDING: "reviewing",
};

function describeCi(pr: PullRequest) {
  const ci = findCiState(pr);
  if (ci === "failing") {
    return { tone: "bad", text: `Failing: ${pr.checks.failing.join(", ")}` };
  }
  if (ci === "running") {
    return { tone: "busy", text: `Running: ${pr.checks.running.join(", ")}` };
  }
  if (ci === "passing") {
    return { tone: "good", text: `${pr.checks.passing} passing` };
  }
  return { tone: "none", text: "None" };
}

function describeMerge(pr: PullRequest) {
  if (pr.mergeable === "CONFLICTING") {
    return `Conflicts with ${pr.baseRef}`;
  }
  if (pr.mergeable === "MERGEABLE") {
    return "Clean";
  }
  return "Checking…";
}

function describeVerdict(pr: PullRequest, now: number) {
  if (isReadyToMerge(pr)) {
    return "Ready to merge";
  }
  if (isStale(pr, now)) {
    return `Quiet for ${Math.floor(daysSinceUpdate(pr, now))} days`;
  }
  return "";
}

function ChangeSplit({ changes }: { changes: ChangeSummary }) {
  const parts = [
    { id: "code", lines: changes.code },
    { id: "tests", lines: changes.tests },
  ];
  return (
    <div className="change-split">
      <div className="change-bar" aria-hidden="true">
        {parts.map((part) => (
          <span key={part.id} className={`change-tone-${part.id}`} style={{ flexGrow: part.lines.additions + part.lines.deletions }} />
        ))}
      </div>
      <ul className="change-legend">
        {parts.map((part) => (
          <li key={part.id}>
            <span className={`change-swatch change-tone-${part.id}`} aria-hidden="true" />
            <span className="plus">+{part.lines.additions}</span> <span className="minus">−{part.lines.deletions}</span> {part.id}
          </li>
        ))}
      </ul>
      {changes.partial && <p className="change-partial">first {MAX_CLASSIFIED_FILES} files</p>}
    </div>
  );
}

export function DetailPanel({ pr, now, onClose, onPick, stacked }: Props) {
  const stage = STAGE_THEMES[findStage(pr)];
  const ci = describeCi(pr);
  const reviewers = [
    ...pr.reviews.filter((review) => review.login !== pr.author).map((review) => ({ who: review.name, state: REVIEW_LABELS[review.state] })),
    ...pr.requestedReviewers.filter((login) => !pr.reviews.some((review) => review.login === login)).map((login) => ({ who: login, state: "asked to review" })),
  ];

  return (
    <motion.aside
      className="parchment"
      aria-label={`Pull request ${pr.number}`}
      initial={{ opacity: 0, y: 30, rotate: -1.5, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
    >
      <button type="button" className="parchment-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <p className="parchment-stage" style={{ color: stage.banner }}>
        {stage.plain}
      </p>
      <h2 className="parchment-title">
        <span className="mono">#{pr.number}</span> {stripTicketPrefix(pr.title)}
      </h2>
      <p className="parchment-meta">
        {pr.authorName} · opened {describeAgo(pr.createdAt, now)} ago · updated {describeAgo(pr.updatedAt, now)} ago
      </p>

      <dl className="parchment-facts">
        <dt>CI</dt>
        <dd className={`ci-${ci.tone}`}>{ci.text}</dd>
        <dt>Merge</dt>
        <dd>{describeMerge(pr)}</dd>
        <dt>Size</dt>
        <dd>
          <span className="plus">+{pr.additions}</span> <span className="minus">−{pr.deletions}</span> · {pr.changedFiles} files
          {pr.additions > MAX_ADDED_LINES ? ` · over ${MAX_ADDED_LINES}` : ""}
          {pr.changes && <ChangeSplit changes={pr.changes} />}
        </dd>
        <dt>Branch</dt>
        <dd className="mono small">
          {pr.headRef} → {pr.baseRef}
        </dd>
        <dt>Reviews</dt>
        <dd>{reviewers.length ? reviewers.map((reviewer) => `${reviewer.who} ${reviewer.state}`).join(" · ") : "None"}</dd>
      </dl>

      {(pr.parent !== null || stacked.length > 0) && (
        <div className="parchment-stack">
          {pr.parent !== null && (
            <button type="button" className="chip" onClick={() => onPick(pr.parent ?? pr.number)}>
              Stacked on #{pr.parent}
            </button>
          )}
          {stacked.map((child) => (
            <button key={child.number} type="button" className="chip" onClick={() => onPick(child.number)}>
              #{child.number} stacked on this
            </button>
          ))}
        </div>
      )}

      <p className="parchment-verdict">{describeVerdict(pr, now)}</p>
      <a className="accio parchment-link" href={pr.url} target="_blank" rel="noreferrer">
        Open on GitHub
      </a>
    </motion.aside>
  );
}
