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
  onRefresh: () => void;
  onHome: () => void;
  onPlayDemo: () => void;
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

export function TopBar({ repo, openCount, status, connected, now, mode, onModeChange, onRefresh, onHome, onPlayDemo }: Props) {
  const liveness = describeLiveness(status, connected, now);
  return (
    <header className="topbar">
      <div className="brand panel">
        <div className="crest" aria-hidden="true">
          PR
        </div>
        <div className="titles">
          <h1>PR Cauldron Hall</h1>
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
        <button type="button" className="ghost-button" onClick={onPlayDemo}>
          Demo
        </button>
        <button type="button" className={`accio${status?.refreshing ? " casting" : ""}`} onClick={onRefresh} disabled={status?.refreshing}>
          <span className="accio-wand" aria-hidden="true" />
          Accio PRs
        </button>
        <SettingsMenu />
      </div>
    </header>
  );
}
