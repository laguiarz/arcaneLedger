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

describe("availableRituals and innate rituals", () => {
  const innateRitual: Spell = {
    name: "Guiding Hand", level: 1, school: "Divination", ritual: true, source: "item",
  };
  const innateNonRitual: Spell = {
    name: "Misty Step", level: 2, school: "Conjuration", source: "race",
  };

  it("includes innate rituals for a non-Wizard", () => {
    // There is no preparation step for a spell you never prepared, so a ritual
    // granted by lineage, a feat or an item is always available.
    const names = availableRituals(
      makeChar({
        className: "Bard",
        spellbook: [],
        preparedSpells: [],
        innateSpells: [innateRitual],
      }),
    ).map((s) => s.name);
    expect(names).toEqual(["Guiding Hand"]);
  });

  it("still hides an unprepared spellbook ritual from a non-Wizard", () => {
    const names = availableRituals(
      makeChar({
        className: "Bard",
        preparedSpells: [],
        innateSpells: [innateRitual],
      }),
    ).map((s) => s.name);
    expect(names).not.toContain("Illusory Script");
    expect(names).toContain("Guiding Hand");
  });

  it("gives a Wizard every spellbook ritual plus the innate ones", () => {
    const names = availableRituals(makeChar({ innateSpells: [innateRitual] })).map(
      (s) => s.name,
    );
    expect(names).toEqual(["Detect Magic", "Illusory Script", "Guiding Hand"]);
  });

  it("ignores innate spells that are not rituals", () => {
    const names = availableRituals(
      makeChar({ className: "Bard", innateSpells: [innateNonRitual] }),
    ).map((s) => s.name);
    expect(names).not.toContain("Misty Step");
  });
});

describe("setMaxHp", () => {
  it("raises the max and leaves current HP alone", () => {
    useCharacter.setState({ character: makeChar() });
    useCharacter.getState().setMaxHp(50);
    const hp = useCharacter.getState().character.hp;
    expect(hp.max).toBe(50);
    expect(hp.current).toBe(20);
  });

  it("clamps current HP down when the new max is lower", () => {
    useCharacter.setState({ character: makeChar() });
    useCharacter.getState().setMaxHp(10);
    const hp = useCharacter.getState().character.hp;
    expect(hp.max).toBe(10);
    expect(hp.current).toBe(10);
  });

  it("never goes below 1", () => {
    useCharacter.setState({ character: makeChar() });
    useCharacter.getState().setMaxHp(0);
    expect(useCharacter.getState().character.hp.max).toBe(1);
    useCharacter.getState().setMaxHp(-5);
    expect(useCharacter.getState().character.hp.max).toBe(1);
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
