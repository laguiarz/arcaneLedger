import { describe, it, expect } from "vitest";
import { buildCombatRecord } from "./combatRecord";
import type { Combatant } from "@/types/combat";

const combatants: Combatant[] = [
  {
    id: "a",
    name: "Brunella",
    kind: "pc",
    initiative: 18,
    conditions: [],
    actions: { 1: { acted: true, text: "sings" } },
  },
];

describe("buildCombatRecord", () => {
  it("snapshots the inputs into an immutable record", () => {
    const rec = buildCombatRecord({
      characterId: "c1",
      combatants,
      rounds: 2,
      endedAt: 1000,
    });
    expect(rec.characterId).toBe("c1");
    expect(rec.rounds).toBe(2);
    expect(rec.endedAt).toBe(1000);
    expect(rec.combatants).toHaveLength(1);
    expect(rec.id).toBeTruthy();
  });

  it("clamps rounds to a minimum of 1", () => {
    const rec = buildCombatRecord({
      characterId: "c1",
      combatants,
      rounds: 0,
      endedAt: 1,
    });
    expect(rec.rounds).toBe(1);
  });

  it("deep-copies combatants so later mutation of the source does not leak in", () => {
    const src = structuredClone(combatants);
    const rec = buildCombatRecord({
      characterId: "c1",
      combatants: src,
      rounds: 1,
      endedAt: 1,
    });
    src[0].name = "MUTATED";
    expect(rec.combatants[0].name).toBe("Brunella");
  });
});
