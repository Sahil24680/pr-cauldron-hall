import type { PollStatus } from "../../shared/board";
import { describeAgo } from "../lib/useNow";
import type { ViewMode } from "../world/player/player";
import { SettingsMenu } from "./SettingsMenu";

type Props = {
  repo: string;
  openCount: number;
  status: PollStatus | null;
  connected: boolean;
  now: number;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  panelsOpen: boolean;
  onTogglePanels: () => void;
  onRefresh: () => void;
  onHome: () => void;
};

function describeLiveness(status: PollStatus | null, connected: boolean, now: number) {
  if (!connected) {
    return { tone: "bad", text: "Reconnecting…" };
  }
  if (status?.refreshing) {
    return { tone: "busy", text: "Fetching…" };
  }
  if (status?.error) {
    return { tone: "bad", text: status.error };
  }
  if (status?.lastPolledAt) {
    return { tone: "live", text: `${describeAgo(status.lastPolledAt, now)} ago` };
  }
  return { tone: "busy", text: "Starting…" };
}

const MODES: { id: ViewMode; label: string; title: string }[] = [
  { id: "third", label: "Third", title: "Third person (V)" },
  { id: "first", label: "First", title: "First person (V)" },
];

export function TopBar({ repo, openCount, status, connected, now, mode, onModeChange, panelsOpen, onTogglePanels, onRefresh, onHome }: Props) {
  const liveness = describeLiveness(status, connected, now);
  return (
    <header className="topbar">
      <div className="brand panel">
        <div className="crest" aria-hidden="true">
          CK
        </div>
        <div className="titles">
          <h1>Cauldron Keep</h1>
          <p className="titles-line">
            <span className="repo">{repo}</span>
            <span>
              <strong>{openCount}</strong> open
            </span>
            <output className={`live live-${liveness.tone}`} title={status?.error ?? undefined}>
              <span className="live-flame" aria-hidden="true" />
              <span className="live-text">{liveness.text}</span>
            </output>
          </p>
        </div>
      </div>
      <div className="topbar-actions panel">
        <fieldset className="modes">
          <legend className="visually-hidden">Camera, press V to switch</legend>
          {MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={mode === option.id}
              title={option.title}
              className="mode"
              onClick={() => onModeChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
        <button type="button" className="ghost-button" onClick={onHome}>
          Home
        </button>
        <button type="button" className={`accio${status?.refreshing ? " casting" : ""}`} onClick={onRefresh} disabled={status?.refreshing}>
          <span className="accio-wand" aria-hidden="true" />
          Accio PRs
        </button>
        <button
          type="button"
          className="gear-button"
          aria-label={panelsOpen ? "Hide side panels (M)" : "Show side panels (M)"}
          aria-pressed={panelsOpen}
          title="Side panels (M)"
          onClick={onTogglePanels}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5zm9-1.5h5.5A1.5 1.5 0 0 1 20 4.5v14a1.5 1.5 0 0 1-1.5 1.5H13zM6 6v2h3V6zm9 0v2h3V6zm-9 4v2h3v-2zm9 0v2h3v-2z"
            />
          </svg>
        </button>
        <SettingsMenu />
      </div>
    </header>
  );
}
