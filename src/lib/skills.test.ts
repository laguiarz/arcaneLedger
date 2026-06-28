import { describe, it, expect } from "vitest";
import type { Character } from "@/types/character";
import { abilityMod, skillModifier, passivePerception } from "@/lib/skills";

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    name: "Test",
    className: "Wizard",
    level: 5,
    proficiencyBonus: 3,
    abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 13, cha: 8 },
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

describe("abilityMod", () => {
  it("computes boundaries via floor((score - 10) / 2)", () => {
    expect(abilityMod(6)).toBe(-2);
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(11)).toBe(0);
    expect(abilityMod(16)).toBe(3);
  });
});

describe("skillModifier", () => {
  it("returns base ability mod when not proficient (no skills entry)", () => {
    const c = makeChar();
    // Arcana uses INT 16 → +3
    expect(skillModifier(c, "arcana")).toBe(3);
    // Acrobatics uses DEX 14 → +2
    expect(skillModifier(c, "acrobatics")).toBe(2);
  });

  it("adds proficiency bonus once when proficient", () => {
    const c = makeChar({ skills: { history: { proficient: true } } });
    // INT 16 (+3) + PB 3 = +6
    expect(skillModifier(c, "history")).toBe(6);
  });

  it("adds proficiency bonus twice with expertise (implies proficient)", () => {
    const c = makeChar({ skills: { arcana: { expertise: true } } });
    // INT 16 (+3) + 2×PB 3 = +9
    expect(skillModifier(c, "arcana")).toBe(9);
  });

  it("treats expertise as 2×PB even without an explicit proficient flag", () => {
    const c = makeChar({ skills: { stealth: { proficient: false, expertise: true } } });
    // DEX 14 (+2) + 2×PB 3 = +8
    expect(skillModifier(c, "stealth")).toBe(8);
  });

  it("treats proficient: false as base ability mod", () => {
    const c = makeChar({ skills: { perception: { proficient: false } } });
    // WIS 13 (+1)
    expect(skillModifier(c, "perception")).toBe(1);
  });
});

describe("passivePerception", () => {
  it("is 10 + perception modifier (not proficient)", () => {
    const c = makeChar();
    // WIS 13 (+1) → 11
    expect(passivePerception(c)).toBe(11);
  });

  it("is 10 + perception modifier (proficient)", () => {
    const c = makeChar({ skills: { perception: { proficient: true } } });
    // WIS 13 (+1) + PB 3 = +4 → 14
    expect(passivePerception(c)).toBe(14);
  });
});

describe("jack of all trades", () => {
  it("adds floor(PB/2) to non-proficient checks for a bard L2+", () => {
    const c = makeChar({ className: "Bard", level: 5 });
    // Arcana INT 16 (+3) + floor(3/2)=1 → 4
    expect(skillModifier(c, "arcana")).toBe(4);
  });

  it("does not stack with proficiency (proficient skill unaffected)", () => {
    const c = makeChar({ className: "Bard", level: 5, skills: { history: { proficient: true } } });
    // INT 16 (+3) + PB 3 = 6 (no extra half)
    expect(skillModifier(c, "history")).toBe(6);
  });

  it("does not stack with expertise", () => {
    const c = makeChar({ className: "Bard", level: 5, skills: { arcana: { expertise: true } } });
    // INT 16 (+3) + 2×PB 3 = 9
    expect(skillModifier(c, "arcana")).toBe(9);
  });

  it("does not apply to non-bards", () => {
    const c = makeChar({ className: "Wizard", level: 5 });
    expect(skillModifier(c, "arcana")).toBe(3);
  });

  it("does not apply to a bard below level 2", () => {
    const c = makeChar({ className: "Bard", level: 1, proficiencyBonus: 2 });
    // INT 16 (+3), no JoAT yet
    expect(skillModifier(c, "arcana")).toBe(3);
  });

  it("applies to passive perception when not proficient", () => {
    const c = makeChar({ className: "Bard", level: 5 });
    // WIS 13 (+1) + floor(3/2)=1 → 2; passive 10 + 2 = 12
    expect(passivePerception(c)).toBe(12);
  });

  it("does not add half-PB to passive perception when proficient", () => {
    const c = makeChar({ className: "Bard", level: 5, skills: { perception: { proficient: true } } });
    // WIS 13 (+1) + PB 3 = 4 → 14
    expect(passivePerception(c)).toBe(14);
  });
});

describe("skills undefined", () => {
  it("yields base ability mod for every skill", () => {
    const c = makeChar({ skills: undefined });
    expect(skillModifier(c, "athletics")).toBe(abilityMod(c.abilities.str));
    expect(skillModifier(c, "persuasion")).toBe(abilityMod(c.abilities.cha));
    expect(skillModifier(c, "investigation")).toBe(abilityMod(c.abilities.int));
  });
});
