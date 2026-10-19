import { describe, expect, it } from "vitest";
import { placeLabel } from "./placeLabel";

const area = { left: 300, top: 20, right: 1000, bottom: 700 };
const size = { width: 200, height: 24 };

describe("placeLabel", () => {
  it("centers the label on its anchor when it fits", () => {
    expect(placeLabel({ x: 600, y: 400 }, size, area)).toEqual({ left: 500, top: 388 });
  });

  it("slides the label inside the left and right edges", () => {
    expect(placeLabel({ x: 320, y: 400 }, size, area)).toEqual({ left: 300, top: 388 });
    expect(placeLabel({ x: 990, y: 400 }, size, area)).toEqual({ left: 800, top: 388 });
  });

  it("slides the label inside the top and bottom edges", () => {
    expect(placeLabel({ x: 600, y: 25 }, size, area)).toEqual({ left: 500, top: 20 });
    expect(placeLabel({ x: 600, y: 695 }, size, area)).toEqual({ left: 500, top: 676 });
  });

  it("hides the label when its anchor is outside the safe area", () => {
    expect(placeLabel({ x: 150, y: 400 }, size, area)).toBeNull();
    expect(placeLabel({ x: 1200, y: 400 }, size, area)).toBeNull();
    expect(placeLabel({ x: 600, y: -10 }, size, area)).toBeNull();
  });
});
