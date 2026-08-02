import { describe, it, expect } from "vitest";
import { parseRechargeDice } from "./rechargeDice";

describe("parseRechargeDice", () => {
  it("reads 1d6 as 1..6", () => {
    expect(parseRechargeDice("1d6")).toEqual({ min: 1, max: 6 });
  });

  it("reads 2d6 as 2..12, not 1..6", () => {
    // Sizing the range from the right-hand side alone would wrongly allow 1
    // and cap at 6.
    expect(parseRechargeDice("2d6")).toEqual({ min: 2, max: 12 });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseRechargeDice(" 1d4 ")).toEqual({ min: 1, max: 4 });
  });

  it("returns null for a shorthand it cannot size", () => {
    expect(parseRechargeDice("d6")).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(parseRechargeDice("banana")).toBeNull();
  });

  it("returns null for zero dice or zero sides", () => {
    expect(parseRechargeDice("0d6")).toBeNull();
    expect(parseRechargeDice("1d0")).toBeNull();
  });
});
