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
    });

    const next = applyDurable(live, durable);

    // Durable fields updated:
    expect(next.level).toBe(6);
    expect(next.proficiencyBonus).toBe(3);
    expect(next.hp.max).toBe(40);
    expect(next.abilities.int.base).toBe(18);
    expect(next.party).toEqual(["Grommash", "Sildar"]);

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
