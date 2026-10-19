import { describe, expect, it } from "vitest";
import { STAGE_ORDER } from "../../lib/theme";
import { targetId, targetOf } from "./targets";

describe("aim target ids", () => {
  it("round-trips PRs and every stage's stack", () => {
    expect(targetOf(targetId({ kind: "pr", number: 42 }))).toEqual({ kind: "pr", number: 42 });
    for (const stage of STAGE_ORDER) {
      expect(targetOf(targetId({ kind: "stack", stage }))).toEqual({ kind: "stack", stage });
    }
  });

  it("never lets a stack collide with a PR number", () => {
    expect(STAGE_ORDER.every((stage) => targetId({ kind: "stack", stage }) < 0)).toBe(true);
  });

  it("finds nothing for an id no stage owns", () => {
    expect(targetOf(-(STAGE_ORDER.length + 1))).toBeNull();
  });
});
