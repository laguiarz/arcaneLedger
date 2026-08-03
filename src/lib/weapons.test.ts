import { describe, it, expect } from "vitest";
import type { Character, Weapon } from "@/types/character";
import {
  weaponAttackBonus,
  weaponDamageBonus,
  weaponDamageLabel,
} from "./weapons";

/** Minimal character carrying only the fields the weapon maths reads. */
function makeChar(over: Partial<Character> = {}): Character {
  return {
    name: "T",
    className: "Bard",
    level: 5,
    proficiencyBonus: 3,
    abilities: {
      str: { base: 10, featBonus: 0, magicBonus: 0 },
      dex: { base: 15, featBonus: 2, magicBonus: 0 },
      con: { base: 11, featBonus: 0, magicBonus: 0 },
      int: { base: 15, featBonus: 0, magicBonus: 0 },
      wis: { base: 11, featBonus: 0, magicBonus: 0 },
      cha: { base: 17, featBonus: 2, magicBonus: 0 },
    },
    savingThrowProficiencies: [],
    hp: { max: 28, current: 28, temp: 0 },
    hitDice: { die: 8, max: 5, spent: 0 },
    spellSlotsMax: {},
    spellSlots: {},
    cantrips: [],
    spellbook: [],
    preparedSpells: [],
    innateSpells: [],
    racialFreeCastsUsed: {},
    resources: [],
    conditions: { active: [], exhaustion: 0 },
    ...over,
  } as Character;
}

const bow: Weapon = {
  name: "Longbow +2",
  ability: "dex",
  proficient: false,
  magicBonus: 2,
  damageDice: "1d8",
  damageType: "Piercing",
};

/** The same bow without its magic bonus, for the mundane cases. */
function mundane(over: Partial<Weapon> = {}): Weapon {
  const { magicBonus: _drop, ...rest } = bow;
  return { ...rest, ...over };
}

/** A character whose Dex is exactly `score`, everything else untouched. */
function withDex(score: number): Character {
  const base = makeChar();
  return makeChar({
    abilities: {
      ...base.abilities,
      dex: { base: score, featBonus: 0, magicBonus: 0 },
    },
  });
}

describe("weaponAttackBonus", () => {
  it("omits the proficiency bonus when not proficient", () => {
    // Dex 15+2 = 17 -> +3, no proficiency, +2 magic.
    expect(weaponAttackBonus(makeChar(), bow)).toBe(5);
  });

  it("adds the proficiency bonus when proficient", () => {
    expect(weaponAttackBonus(makeChar(), { ...bow, proficient: true })).toBe(8);
  });

  it("treats a missing magicBonus as zero", () => {
    expect(weaponAttackBonus(makeChar(), mundane())).toBe(3);
  });

  it("counts a feat ability bonus", () => {
    // Dex base 15 alone would be +2, giving +4. The feat's +2 makes it 17 -> +3.
    expect(weaponAttackBonus(withDex(15), bow)).toBe(4);
    expect(weaponAttackBonus(makeChar(), bow)).toBe(5);
  });
});

describe("weaponDamageLabel", () => {
  it("signs a positive bonus", () => {
    expect(weaponDamageLabel(makeChar(), bow)).toBe("1d8+5 Piercing");
  });

  it("omits a zero bonus entirely", () => {
    expect(weaponDamageLabel(withDex(10), mundane())).toBe("1d8 Piercing");
  });

  it("signs a negative bonus", () => {
    expect(weaponDamageBonus(withDex(8), mundane())).toBe(-1);
    expect(weaponDamageLabel(withDex(8), mundane())).toBe("1d8-1 Piercing");
  });
});
