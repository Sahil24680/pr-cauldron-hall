import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { closeSettings, openSettings, useSettingsOpen } from "../lib/settingsMenu";
import { releaseLock } from "../world/player/pointerLock";
import { CAMERA_DISTANCE_RANGE, SENSITIVITY_RANGE, updatePlayerSettings, usePlayerSettings } from "../world/player/settings";
import { AppearanceEditor } from "./AppearanceEditor";

type Tab = "help" | "appearance" | "settings" | "legend";

const TABS: { id: Tab; label: string }[] = [
  { id: "help", label: "Help" },
  { id: "appearance", label: "Appearance" },
  { id: "settings", label: "Settings" },
  { id: "legend", label: "Reading the hall" },
];

const CONTROLS: { keys: string[]; action: string }[] = [
  { keys: ["W", "A", "S", "D"], action: "Walk; in third person relative to the camera, turning the wizard to match" },
  { keys: ["W", "W"], action: "Double tap and hold to sprint" },
  { keys: ["Shift", "Ctrl", "C"], action: "Fly down while flying" },
  { keys: ["Space"], action: "Jump, or fly up while flying" },
  { keys: ["Space", "Space"], action: "Double tap to start flying, again to drop" },
  { keys: ["Mouse"], action: "Look around, or orbit the camera in third person; the marker in the middle (the wand in first person) is your aim" },
  { keys: ["Scroll"], action: "Move the third-person camera closer or farther" },
  { keys: ["Click"], action: "Read the PR or open the ledger under your aim, or enter the hall when paused" },
  { keys: ["E"], action: "Read the PR or open the ledger under your aim" },
  { keys: ["Esc"], action: "Open this menu and get the mouse back, or close a card" },
  { keys: ["V", "F5"], action: "Switch between first and third person" },
  { keys: ["M"], action: "Show or hide the side panels" },
];

const LEGEND = [
  { mark: "orb-green", text: "Green brew: CI passing" },
  { mark: "orb-purple", text: "Purple, bubbling hard: CI running" },
  { mark: "orb-red", text: "Red brew with black smoke: CI failing" },
  { mark: "cloud", text: "Rain cloud over the cauldron: merge conflict" },
  { mark: "stone", text: "Wizard turned to stone: no update in 7 days" },
  { mark: "books", text: "Stack of books: over 500 added lines" },
  { mark: "ring", text: "Gold ring and broom: ready to merge" },
  { mark: "thread", text: "Gold thread: stacked on another PR" },
];

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.4h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
        transform="translate(-1 0)"
      />
    </svg>
  );
}

function GameSettings() {
  const { sensitivity, invertY, headBob, cameraDistance, recenterCamera } = usePlayerSettings();
  return (
    <div className="game-settings">
      <label className="setting">
        <span>Mouse sensitivity</span>
        <input
          type="range"
          min={SENSITIVITY_RANGE.min}
          max={SENSITIVITY_RANGE.max}
          step={SENSITIVITY_RANGE.step}
          value={sensitivity}
          onChange={(event) => updatePlayerSettings({ sensitivity: event.target.valueAsNumber })}
        />
        <output>{Math.round(sensitivity * 100)}%</output>
      </label>
      <label className="setting">
        <span>Invert mouse up and down</span>
        <input type="checkbox" checked={invertY} onChange={(event) => updatePlayerSettings({ invertY: event.target.checked })} />
      </label>
      <label className="setting">
        <span>Head bob while walking</span>
        <input type="checkbox" checked={headBob} onChange={(event) => updatePlayerSettings({ headBob: event.target.checked })} />
      </label>
      <label className="setting">
        <span>Third-person camera distance</span>
        <input
          type="range"
          min={CAMERA_DISTANCE_RANGE.min}
          max={CAMERA_DISTANCE_RANGE.max}
          step={CAMERA_DISTANCE_RANGE.step}
          value={cameraDistance}
          onChange={(event) => updatePlayerSettings({ cameraDistance: event.target.valueAsNumber })}
        />
        <output>{cameraDistance.toFixed(1)} m</output>
      </label>
      <label className="setting">
        <span>Swing the camera behind you while walking</span>
        <input type="checkbox" checked={recenterCamera} onChange={(event) => updatePlayerSettings({ recenterCamera: event.target.checked })} />
      </label>
    </div>
  );
}

function TabContent({ tab }: { tab: Tab }) {
  if (tab === "appearance") {
    return <AppearanceEditor />;
  }
  if (tab === "settings") {
    return <GameSettings />;
  }
  if (tab === "legend") {
    return (
      <ul className="settings-legend">
        {LEGEND.map((entry) => (
          <li key={entry.mark}>
            <span className={`legend-mark ${entry.mark}`} aria-hidden="true" />
            {entry.text}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <dl className="controls">
      {CONTROLS.map((control) => (
        <div key={control.action} className="control">
          <dt>
            {control.keys.map((key, index) => (
              <kbd key={`${key}-${index}`}>{key}</kbd>
            ))}
          </dt>
          <dd>{control.action}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SettingsMenu() {
  const open = useSettingsOpen();
  const [tab, setTab] = useState<Tab>("help");
  const docked = tab === "appearance" ? " docked" : "";

  useEffect(() => {
    if (open) {
      releaseLock();
    }
  }, [open]);

  return (
    <>
      <button type="button" className="gear-button" aria-label="Settings and help" aria-expanded={open} onClick={open ? closeSettings : openSettings}>
        <GearIcon />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="backdrop"
              className={`settings-backdrop${docked}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSettings}
            />
          )}
          {open && (
            <motion.div key="layer" className={`settings-layer${docked}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.dialog
                open
                className="settings parchment"
                aria-label="Settings and help"
                initial={{ y: 24, scale: 0.96, rotate: -1 }}
                animate={{ y: 0, scale: 1, rotate: 0 }}
                exit={{ y: 16, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
              >
                <button type="button" className="parchment-close" onClick={closeSettings} aria-label="Close">
                  ×
                </button>
                <div className="settings-tabs" role="tablist">
                  {TABS.map(({ id, label }) => (
                    <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                      {label}
                    </button>
                  ))}
                </div>
                <TabContent tab={tab} />
              </motion.dialog>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
