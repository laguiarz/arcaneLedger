import { describe, it, expect } from "vitest";
import type { Character } from "@/types/character";
import {
  abilityMod,
  abilityScore,
  effectiveScore,
  makeBreakdown,
  normalizeAbilities,
  toAbilityScores,
} from "@/lib/abilities";

describe("abilityMod", () => {
  it("matches the 5e table", () => {
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(20)).toBe(5);
  });
});

describe("effectiveScore", () => {
  it("sums base + feat + magic", () => {
    expect(effectiveScore(makeBreakdown(15, 2, 1))).toBe(18);
  });
  it("drops magic when includeMagic=false (antimagic field)", () => {
    expect(effectiveScore(makeBreakdown(15, 2, 3), false)).toBe(17);
  });
});

describe("toAbilityScores", () => {
  it("wraps plain numbers as base with zero feat/magic", () => {
    const s = toAbilityScores({ str: 8, dex: 14, con: 12, int: 16, wis: 13, cha: 10 });
    expect(s.int).toEqual({ base: 16, featBonus: 0, magicBonus: 0 });
  });
});

describe("normalizeAbilities", () => {
  it("coerces the old flat-number format", () => {
    const s = normalizeAbilities({ str: 8, dex: 14, con: 12, int: 16, wis: 13, cha: 10 });
    expect(s.dex).toEqual({ base: 14, featBonus: 0, magicBonus: 0 });
  });
  it("preserves partial breakdowns and fills missing parts", () => {
    const s = normalizeAbilities({ str: { base: 15, magicBonus: 2 } });
    expect(s.str).toEqual({ base: 15, featBonus: 0, magicBonus: 2 });
  });
  it("defaults missing abilities to 10", () => {
    const s = normalizeAbilities({});
    expect(s.wis).toEqual({ base: 10, featBonus: 0, magicBonus: 0 });
  });
});

describe("abilityScore", () => {
  const c = {
    abilities: {
      str: makeBreakdown(10),
      dex: makeBreakdown(14, 0, 0),
      con: makeBreakdown(12),
      int: makeBreakdown(16, 1, 2),
      wis: makeBreakdown(13),
      cha: makeBreakdown(8),
    },
  } as unknown as Character;

  it("returns the summed effective score", () => {
    expect(abilityScore(c, "int")).toBe(19);
  });
  it("suppresses magic in an antimagic field", () => {
    expect(abilityScore(c, "int", { includeMagic: false })).toBe(17);
  });
});
