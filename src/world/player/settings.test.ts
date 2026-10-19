import { describe, expect, it } from "vitest";
import { parseSettings } from "./settings";

const DEFAULTS = { sensitivity: 1, invertY: false, headBob: true, cameraDistance: 4.2, recenterCamera: true };

describe("parseSettings", () => {
  it("falls back to defaults for missing or broken storage", () => {
    expect(parseSettings(null)).toEqual(DEFAULTS);
    expect(parseSettings({ sensitivity: "fast", invertY: true, cameraDistance: 50 })).toEqual({ ...DEFAULTS, invertY: true });
  });

  it("keeps valid stored choices", () => {
    const stored = { sensitivity: 2.5, invertY: true, headBob: false, cameraDistance: 2, recenterCamera: false };
    expect(parseSettings(stored)).toEqual(stored);
  });
});
