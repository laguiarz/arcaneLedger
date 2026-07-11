import { describe, it, expect } from "vitest";
import { coinBalance, type CoinEntry } from "@/store/coin";

const e = (amount: number): CoinEntry => ({ id: String(amount), amount, note: "" });

describe("coinBalance", () => {
  it("returns starting gold with no entries", () => {
    expect(coinBalance(100, [])).toBe(100);
  });
  it("adds income and subtracts expenses", () => {
    expect(coinBalance(100, [e(50), e(-30), e(10)])).toBe(130);
  });
  it("can go negative", () => {
    expect(coinBalance(0, [e(-25)])).toBe(-25);
  });
});
