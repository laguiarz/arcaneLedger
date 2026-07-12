import { describe, it, expect } from "vitest";
import { nextTheme, normalizeTheme } from "@/store/theme";

describe("nextTheme", () => {
  it("toggles dark to light", () => {
    expect(nextTheme("dark")).toBe("light");
  });
  it("toggles light to dark", () => {
    expect(nextTheme("light")).toBe("dark");
  });
});

describe("normalizeTheme", () => {
  it("defaults unknown values to dark", () => {
    expect(normalizeTheme("purple")).toBe("dark");
    expect(normalizeTheme(undefined)).toBe("dark");
    expect(normalizeTheme(null)).toBe("dark");
  });
  it("passes through valid themes", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("dark")).toBe("dark");
  });
});
