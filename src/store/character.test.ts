import { describe, it, expect } from "vitest";
import type { Character, Spell } from "@/types/character";
import { availableRituals, useCharacter } from "@/store/character";
import { toAbilityScores } from "@/lib/abilities";

const ritualPrepared: Spell = {
  name: "Detect Magic", level: 1, school: "Divination", ritual: true,
};
const ritualUnprepared: Spell = {
  name: "Illusory Script", level: 1, school: "Illusion", ritual: true,
};
const nonRitual: Spell = {
  name: "Magic Missile", level: 1, school: "Evocation",
};

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
    spellbook: [ritualPrepared, ritualUnprepared, nonRitual],
    preparedSpells: ["Detect Magic"],
    innateSpells: [],
    racialFreeCastsUsed: {},
    resources: [],
    conditions: { active: [], exhaustion: 0 },
    concentration: null,
    ...overrides,
  };
}

describe("availableRituals", () => {
  it("returns every spellbook ritual for a Wizard (Ritual Adept)", () => {
    const names = availableRituals(makeChar()).map((s) => s.name);
    expect(names).toEqual(["Detect Magic", "Illusory Script"]);
  });

  it("returns only prepared rituals for a non-Wizard (e.g. Bard)", () => {
    const names = availableRituals(makeChar({ className: "Bard" })).map((s) => s.name);
    expect(names).toEqual(["Detect Magic"]);
  });

  it("never returns non-ritual spells", () => {
    const names = availableRituals(makeChar()).map((s) => s.name);
    expect(names).not.toContain("Magic Missile");
  });
});

describe("setNarrationPrompt", () => {
  it("stores a per-character prompt and clears back to undefined when emptied", () => {
    useCharacter.setState({ character: makeChar() });
    useCharacter.getState().setNarrationPrompt("Narrá con ironía.");
    expect(useCharacter.getState().character.narrationPrompt).toBe("Narrá con ironía.");

    // Blank input clears it (falls back to the default at read time).
    useCharacter.getState().setNarrationPrompt("   ");
    expect(useCharacter.getState().character.narrationPrompt).toBeUndefined();
  });
});
