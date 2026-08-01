import { describe, it, expect } from "vitest";
import { formatVersion } from "./appVersion";

describe("formatVersion", () => {
  it("renders commit, date and time", () => {
    // Built from a local Date on purpose, so the expectation holds in any tz.
    const d = new Date(2026, 7, 1, 15, 4); // 1 Aug 2026, 15:04 local
    expect(formatVersion("f4b3544", d.toISOString())).toBe(
      "f4b3544 · 1 ago 2026, 15:04",
    );
  });

  it("pads single-digit hours and minutes", () => {
    const d = new Date(2026, 0, 9, 4, 7); // 9 Jan 2026, 04:07 local
    expect(formatVersion("abc1234", d.toISOString())).toBe(
      "abc1234 · 9 ene 2026, 04:07",
    );
  });

  it("falls back to the commit alone when the timestamp is unusable", () => {
    expect(formatVersion("dev", "not-a-date")).toBe("dev");
    expect(formatVersion("dev", "")).toBe("dev");
  });
});
