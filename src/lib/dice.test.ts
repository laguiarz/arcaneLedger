import { describe, it, expect } from "vitest";
import type { Character } from "@/types/character";
import { rollD20, rollSkillCheck } from "@/lib/dice";
import { toAbilityScores } from "@/lib/abilities";

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    name: "Test",
    className: "Wizard",
    level: 5,
    proficiencyBonus: 3,
    abilities: toAbilityScores({ str: 10, dex: 14, con: 12, int: 16, wis: 13, cha: 8 }),
    savingThrowProficiencies: [],
    hp: { max: 20, current: 20, temp: 0 },
    hitDice: { die: 6, max: 5, spent: 0 },
    spellSlotsMax: {},
    spellSlots: {},
    cantrips: [],
    spellbook: [],
    preparedSpells: [],
    innateSpells: [],
    racialFreeCastsUsed: {},
    resources: [],
    conditions: { active: [], exhaustion: 0 },
    concentration: null,
    ...overrides,
  };
}

describe("rollD20", () => {
  it("maps rng 0 to a natural 1 and ~1 to a natural 20", () => {
    expect(rollD20(() => 0)).toBe(1);
    expect(rollD20(() => 0.999999)).toBe(20);
  });

  it("maps the middle of the range to 11", () => {
    // floor(0.5 * 20) + 1 = 11
    expect(rollD20(() => 0.5)).toBe(11);
  });

  it("only ever yields naturals within 1..20", () => {
    for (let i = 0; i < 100; i++) {
      const n = rollD20();
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(20);
    }
  });
});

describe("rollSkillCheck", () => {
  it("totals natural + modifier for a non-proficient skill", () => {
    const c = makeChar();
    // Arcana uses INT 16 (+3); rng 0.5 -> natural 11; total 14
    expect(rollSkillCheck(c, "arcana", () => 0.5)).toEqual({
      natural: 11,
      mod: 3,
      total: 14,
    });
  });

  it("totals natural + modifier for a proficient skill", () => {
    const c = makeChar({ skills: { history: { proficient: true } } });
    // INT 16 (+3) + PB 3 = +6; rng 0 -> natural 1; total 7
    expect(rollSkillCheck(c, "history", () => 0)).toEqual({
      natural: 1,
      mod: 6,
      total: 7,
    });
  });

  it("totals natural + modifier for an expertise skill", () => {
    const c = makeChar({ skills: { arcana: { expertise: true } } });
    // INT 16 (+3) + 2×PB 3 = +9; rng ~1 -> natural 20; total 29
    expect(rollSkillCheck(c, "arcana", () => 0.999999)).toEqual({
      natural: 20,
      mod: 9,
      total: 29,
    });
  });
});
