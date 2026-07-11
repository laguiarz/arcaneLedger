import { describe, it, expect } from "vitest";
import type { Character } from "@/types/character";
import { toAbilityScores } from "@/lib/abilities";
import { armorClass, dexAcContribution, defaultArmorConfig } from "@/lib/armor";

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    name: "Test",
    className: "Fighter",
    level: 5,
    proficiencyBonus: 3,
    abilities: toAbilityScores({ str: 10, dex: 16, con: 12, int: 10, wis: 10, cha: 10 }),
    savingThrowProficiencies: [],
    hp: { max: 20, current: 20, temp: 0 },
    hitDice: { die: 10, max: 5, spent: 0 },
    spellSlotsMax: {},
    spellSlots: {},
    cantrips: [],
    spellbook: [],
    preparedSpells: [],
    innateSpells: [],
    racialFreeCastsUsed: {},
    resources: [],
    conditions: { active: [], exhaustion: 0 },
    ...overrides,
  };
}

describe("dexAcContribution", () => {
  it("adds full Dex for light/no armor", () => {
    expect(dexAcContribution("full", 3)).toBe(3);
  });
  it("caps Dex at +2 for medium armor", () => {
    expect(dexAcContribution("max2", 3)).toBe(2);
    expect(dexAcContribution("max2", 1)).toBe(1);
  });
  it("ignores Dex for heavy armor", () => {
    expect(dexAcContribution("none", 3)).toBe(0);
  });
});

describe("armorClass", () => {
  it("falls back to flat ac when no armor config", () => {
    expect(armorClass(makeChar({ ac: 15 }))).toBe(15);
  });
  it("defaults to 10 with neither armor nor ac", () => {
    expect(armorClass(makeChar())).toBe(10);
  });
  it("computes light armor with full Dex (Dex 16 → +3)", () => {
    const c = makeChar({ armor: { base: 12, dexMode: "full", shield: false, miscBonus: 0 } });
    expect(armorClass(c)).toBe(15);
  });
  it("caps Dex for medium armor and adds shield + misc", () => {
    const c = makeChar({ armor: { base: 14, dexMode: "max2", shield: true, miscBonus: 1 } });
    // 14 + min(2,3) + 2 + 1 = 19
    expect(armorClass(c)).toBe(19);
  });
  it("tracks Dexterity changes live via the breakdown", () => {
    const base = makeChar({ armor: { base: 11, dexMode: "full", shield: false, miscBonus: 0 } });
    const buffed: Character = {
      ...base,
      abilities: { ...base.abilities, dex: { base: 20, featBonus: 0, magicBonus: 0 } },
    };
    expect(armorClass(base)).toBe(14); // 11 + 3
    expect(armorClass(buffed)).toBe(16); // 11 + 5
  });
});

describe("defaultArmorConfig", () => {
  it("back-solves base so computed AC initially matches flat ac", () => {
    const c = makeChar({ ac: 14 }); // Dex 16 → +3
    const cfg = defaultArmorConfig(c);
    expect(cfg).toEqual({ base: 11, dexMode: "full", shield: false, miscBonus: 0 });
    expect(armorClass({ ...c, armor: cfg })).toBe(14);
  });
});
