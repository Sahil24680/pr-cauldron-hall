import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CAST } from "../../shared/cast";

const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(DEFAULT_CAST)));

async function freshStore() {
  vi.resetModules();
  return import("./castStore");
}

describe("castStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("applies an edit at once and saves it once after the last change", async () => {
    const { updateCastMember } = await freshStore();
    fetchMock.mockClear();

    updateCastMember("draft", { glasses: "square" });
    updateCastMember("draft", { hairColor: "#112233" });
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/cast/draft");
    expect(JSON.parse(String(init?.body))).toMatchObject({ glasses: "square", hairColor: "#112233" });
  });

  it("ignores an edit that would break the schema", async () => {
    const { updateCastMember } = await freshStore();
    fetchMock.mockClear();
    updateCastMember("review", { hairColor: "not a colour" });
    updateCastMember("review", { glasses: "round" });
    await vi.runAllTimersAsync();
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({ hairColor: DEFAULT_CAST.review.hairColor, glasses: "round" });
  });

  it("cancels a pending save and shows the member the server reset to", async () => {
    const { resetCastMember, updateCastMember } = await freshStore();
    const committed = { ...DEFAULT_CAST.draft, hairColor: "#abcdef" };
    updateCastMember("draft", { glasses: "square" });
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...DEFAULT_CAST, draft: committed })));

    await resetCastMember("draft");
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/cast/draft/reset");
    expect(init?.method).toBe("POST");

    updateCastMember("draft", { wand: "elder" });
    await vi.runAllTimersAsync();
    const [, save] = fetchMock.mock.calls[1] ?? [];
    expect(JSON.parse(String(save?.body))).toEqual({ ...committed, wand: "elder" });
  });
});
