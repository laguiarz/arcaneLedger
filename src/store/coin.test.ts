import { describe, it, expect, beforeEach } from "vitest";
import {
  coinBalance,
  purseFor,
  useCoin,
  type Purse,
} from "@/store/coin";

const purse = (startingGold: number, amounts: number[]): Purse => ({
  startingGold,
  entries: amounts.map((amount, i) => ({ id: String(i), amount, note: "" })),
  treasure: [],
});

beforeEach(() => useCoin.setState({ purses: {} }));

describe("coinBalance", () => {
  it("returns starting gold with no entries", () => {
    expect(coinBalance(purse(100, []))).toBe(100);
  });
  it("adds income and subtracts expenses", () => {
    expect(coinBalance(purse(100, [50, -30, 10]))).toBe(130);
  });
  it("can go negative", () => {
    expect(coinBalance(purse(0, [-25]))).toBe(-25);
  });
});

describe("purseFor", () => {
  it("returns an empty purse for an unknown character", () => {
    expect(purseFor({ purses: {} }, "nobody")).toEqual({
      startingGold: 0,
      entries: [],
      treasure: [],
    });
  });

  it("returns a STABLE reference for a missing purse (no getSnapshot loop)", () => {
    const state = { purses: {} };
    // Same identity across calls → safe to use directly as a Zustand selector.
    expect(purseFor(state, "nobody")).toBe(purseFor(state, "nobody"));
  });
});

describe("useCoin — per-character purses", () => {
  it("keeps each character's gold separate", () => {
    useCoin.getState().setStartingGold("c1", 100);
    useCoin.getState().addEntry("c1", 50, "sold gems");
    useCoin.getState().addEntry("c2", 10, "found coins");

    expect(coinBalance(purseFor(useCoin.getState(), "c1"))).toBe(150);
    expect(coinBalance(purseFor(useCoin.getState(), "c2"))).toBe(10);
  });

  it("adds newest-first and removes entries by id", () => {
    useCoin.getState().addEntry("c1", 5, "first");
    useCoin.getState().addEntry("c1", 7, "second");
    const p = purseFor(useCoin.getState(), "c1");
    expect(p.entries[0].note).toBe("second");
    useCoin.getState().removeEntry("c1", p.entries[0].id);
    expect(purseFor(useCoin.getState(), "c1").entries).toHaveLength(1);
  });

  it("tracks treasure per character", () => {
    useCoin.getState().addTreasure("c1", "Ruby");
    expect(purseFor(useCoin.getState(), "c1").treasure[0].text).toBe("Ruby");
  });

  it("adopts the legacy purse into a character only once", () => {
    useCoin.setState({
      purses: { __legacy__: purse(200, [25]) },
    });
    useCoin.getState().adoptLegacyPurse("c1");
    expect(coinBalance(purseFor(useCoin.getState(), "c1"))).toBe(225);
    expect(useCoin.getState().purses.__legacy__).toBeUndefined();

    // Second call is a no-op (c1 already has a purse) and never clobbers it.
    useCoin.getState().setStartingGold("c1", 999);
    useCoin.getState().adoptLegacyPurse("c1");
    expect(purseFor(useCoin.getState(), "c1").startingGold).toBe(999);
  });
});
