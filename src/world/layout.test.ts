import { describe, expect, it } from "vitest";
import { makePullRequest } from "../../test/factories";
import {
  DOOR,
  FRONT_EDGE_Z,
  GRAND_CAULDRON_RADIUS,
  HALL_HALF_WIDTH,
  MAX_WIZARDS_PER_ZONE,
  type Point,
  hallBounds,
  layoutHall,
  routeBetween,
  routeFromDoor,
  zoneX,
} from "./layout";

const drafts = [1, 2, 3].map((number) => makePullRequest({ number, isDraft: true }));
const approved = makePullRequest({ number: 9, reviewDecision: "APPROVED" });

describe("layoutHall", () => {
  const { stations, zones, backZ, obstacles } = layoutHall([...drafts, approved]);

  it("gives every PR a station in its stage's zone, two cauldrons per row", () => {
    expect(stations.size).toBe(4);
    const draftStations = drafts.map((pr) => stations.get(pr.number));
    expect(draftStations.every((station) => station?.stage === "draft")).toBe(true);
    expect(new Set(draftStations.map((station) => station?.cauldron.x)).size).toBe(2);
    expect(stations.get(9)?.cauldron.x).toBeCloseTo(zoneX("approved") - 1.6);
  });

  it("seats every wizard at a cauldron of its own while a stage has room", () => {
    expect([...stations.values()].every((station) => !station.stacked)).toBe(true);
    expect(new Set(stations.values()).size).toBe(4);
  });

  it("puts each wizard behind its cauldron, facing it", () => {
    const station = stations.get(1);
    expect(station?.spot.z).toBeLessThan(station?.cauldron.z ?? 0);
    expect(station?.facing).toBe(0);
  });

  it("makes one zone per stage and an obstacle per cauldron, inside the hall", () => {
    expect(zones.map((zone) => zone.stage)).toEqual(["draft", "review", "changes", "approved"]);
    expect(obstacles).toHaveLength(4);
    const bounds = hallBounds(backZ, 0);
    expect(bounds.maxX).toBe(HALL_HALF_WIDTH);
    expect(bounds.maxZ).toBe(FRONT_EDGE_Z);
    expect(Math.min(...zones.map((zone) => zone.endZ))).toBeGreaterThan(backZ);
  });
});

describe("layoutHall with a crowded stage", () => {
  const crowdedDrafts = Array.from({ length: MAX_WIZARDS_PER_ZONE + 3 }, (_, index) =>
    makePullRequest({ number: index + 1, isDraft: true, updatedAt: `2026-10-${String(10 + index).padStart(2, "0")}T00:00:00.000Z` }),
  );
  const crowded = layoutHall([...crowdedDrafts, approved]);
  const quiet = layoutHall([approved]);
  const stack = crowded.stacks.get("draft");

  it("hands a stage of five or more PRs to one Headmaster, newest first", () => {
    expect(stack?.numbers).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect(stack?.station.stacked).toBe(true);
    expect(crowded.stacks.has("approved")).toBe(false);
  });

  it("points every stacked PR at the Headmaster's station, so effects and focus land on him", () => {
    expect(crowdedDrafts.every((pr) => crowded.stations.get(pr.number) === stack?.station)).toBe(true);
    expect(crowded.stations.get(9)?.stacked).toBe(false);
  });

  it("stacks only past four, keeping four PRs as four wizards", () => {
    const four = layoutHall(crowdedDrafts.slice(0, MAX_WIZARDS_PER_ZONE));
    expect(four.stacks.size).toBe(0);
    expect(new Set(four.stations.values()).size).toBe(MAX_WIZARDS_PER_ZONE);
  });

  it("blocks the grand cauldron, the lectern and the brewing students instead of seven cauldrons", () => {
    const cauldronAndLectern = 2;
    const approvedCauldron = 1;
    expect(crowded.obstacles).toHaveLength(cauldronAndLectern + (stack?.brewers.length ?? 0) + approvedCauldron);
    const station = stack?.station;
    expect(crowded.obstacles.some((rect) => station && rect.minX < station.cauldron.x && rect.maxX > station.cauldron.x)).toBe(true);
  });

  it("stands the students clear of the grand cauldron, each brewer facing into it", () => {
    const cauldron = stack?.station.cauldron;
    const clearOfCauldron = (point: Point) => cauldron !== undefined && Math.hypot(point.x - cauldron.x, point.z - cauldron.z) > GRAND_CAULDRON_RADIUS;
    expect(stack?.brewers.length).toBeGreaterThan(0);
    for (const brewer of stack?.brewers ?? []) {
      expect(clearOfCauldron(brewer.spot)).toBe(true);
      const toCauldron = cauldron ? Math.atan2(cauldron.x - brewer.spot.x, cauldron.z - brewer.spot.z) : Number.NaN;
      expect(Math.cos(brewer.facing - toCauldron)).toBeCloseTo(1);
    }
    expect(stack && clearOfCauldron(stack.bookRun.drop.spot)).toBe(true);
  });

  it("keeps every zone and the back wall where they are, however many PRs there are", () => {
    expect(crowded.zones).toEqual(quiet.zones);
    expect(crowded.backZ).toBe(quiet.backZ);
    const zone = crowded.zones.find((candidate) => candidate.stage === "draft");
    expect(stack && zone && stack.station.spot.z > zone.endZ && stack.station.cauldron.z < zone.startZ).toBe(true);
  });
});

describe("routes", () => {
  const { stations } = layoutHall([approved, makePullRequest({ number: 5 })]);
  const to = stations.get(9);
  const from = stations.get(5);

  it("ends exactly at the destination spot", () => {
    if (!to || !from) {
      throw new Error("stations missing");
    }
    expect(routeBetween(from.spot, to).at(-1)).toEqual(to.spot);
    expect(routeFromDoor(to).at(-1)).toEqual(to.spot);
    expect(routeFromDoor(to)[0]?.x).toBe(DOOR.x);
  });
});
