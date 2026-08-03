import { describe, it, expect } from "vitest";
import { extractDurable, applyDurable } from "./durableSheet";
import { sampleWizard } from "@/data/sampleWizard";
import type { Character } from "@/types/character";

describe("extractDurable", () => {
  it("picks only the durable sheet fields", () => {
    const d = extractDurable(sampleWizard);
    expect(d.abilities).toEqual(sampleWizard.abilities);
    expect(d.hpMax).toBe(sampleWizard.hp.max);
    expect(d.level).toBe(sampleWizard.level);
    expect(d.proficiencyBonus).toBe(sampleWizard.proficiencyBonus);
    expect(d.party).toEqual(sampleWizard.party ?? []);
    // No volatile/session fields leak into the durable blob.
    expect(d).not.toHaveProperty("hp");
    expect(d).not.toHaveProperty("spellSlots");
    expect(d).not.toHaveProperty("conditions");
  });
});

describe("extractDurable — custom spells", () => {
  it("always emits customSpells, empty arrays included", () => {
    // Empty means "she has none", which is how a deletion reaches the other
    // devices. Omitting the key would make it indistinguishable from an older
    // build's push.
    const d = extractDurable(sampleWizard);
    expect(d.customSpells).toEqual({ spellbook: [], cantrips: [] });
  });

  it("picks up custom entries and excludes library ones", () => {
    const c: Character = {
      ...sampleWizard,
      spellbook: [
        { name: "Shield", level: 1, school: "Abjuration", source: "class" },
        { name: "Fireball", level: 3, school: "Evocation", source: "custom" },
      ],
      cantrips: [
        { name: "Fire Bolt", school: "Evocation", source: "class" },
        { name: "Spark", school: "Evocation", source: "custom" },
      ],
    };
    const d = extractDurable(c);
    expect(d.customSpells.spellbook.map((s) => s.name)).toEqual(["Fireball"]);
    expect(d.customSpells.cantrips.map((s) => s.name)).toEqual(["Spark"]);
  });
});

describe("applyDurable", () => {
  it("replaces durable fields but preserves volatile session state", () => {
    // Start from a character mid-fight: damaged, slots spent, a condition on.
    const live: Character = {
      ...sampleWizard,
      hp: { max: 26, current: 7, temp: 3 },
      spellSlots: { 1: 0, 2: 1 },
      conditions: { active: ["poisoned"], exhaustion: 2 },
      hitDice: { ...sampleWizard.hitDice, spent: 3 },
    };

    const durable = extractDurable({
      ...sampleWizard,
      level: 6,
      proficiencyBonus: 3,
      hp: { max: 40, current: 40, temp: 0 },
      abilities: {
        ...sampleWizard.abilities,
        int: { base: 18, featBonus: 2, magicBonus: 0 },
      },
      party: ["Grommash", "Sildar"],
      narrationPrompt: "Narrá como un juglar sarcástico.",
    });

    const next = applyDurable(live, durable);

    // Durable fields updated:
    expect(next.level).toBe(6);
    expect(next.proficiencyBonus).toBe(3);
    expect(next.hp.max).toBe(40);
    expect(next.abilities.int.base).toBe(18);
    expect(next.party).toEqual(["Grommash", "Sildar"]);
    expect(next.narrationPrompt).toBe("Narrá como un juglar sarcástico.");

    // Volatile session state preserved:
    expect(next.hp.current).toBe(7);
    expect(next.hp.temp).toBe(3);
    expect(next.spellSlots).toEqual({ 1: 0, 2: 1 });
    expect(next.conditions).toEqual({ active: ["poisoned"], exhaustion: 2 });
    expect(next.hitDice.spent).toBe(3);
  });

  it("clamps current HP down when the new max is lower", () => {
    const live: Character = {
      ...sampleWizard,
      hp: { max: 40, current: 40, temp: 0 },
    };
    const durable = extractDurable({ ...sampleWizard, hp: { max: 20, current: 20, temp: 0 } });
    const next = applyDurable(live, durable);
    expect(next.hp.max).toBe(20);
    expect(next.hp.current).toBe(20); // clamped from 40
  });
});
