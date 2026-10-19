import { describe, expect, it } from "vitest";
import { stripTicketPrefix } from "./title";

describe("stripTicketPrefix", () => {
  it("strips a ticket, NA or HF prefix", () => {
    expect(stripTicketPrefix("[DEV-42] feat(board): add tags")).toBe("feat(board): add tags");
    expect(stripTicketPrefix("[NA] chore: bump deps")).toBe("chore: bump deps");
    expect(stripTicketPrefix("[HF] fix(review): clear filters")).toBe("fix(review): clear filters");
  });

  it("strips several prefixes in a row", () => {
    expect(stripTicketPrefix("[DEV-12] [HF] fix: hotfix")).toBe("fix: hotfix");
  });

  it("keeps titles without a prefix and brackets later in the title", () => {
    expect(stripTicketPrefix("feat: add [beta] badge")).toBe("feat: add [beta] badge");
    expect(stripTicketPrefix("[docs] lowercase is not a ticket")).toBe("[docs] lowercase is not a ticket");
  });
});
