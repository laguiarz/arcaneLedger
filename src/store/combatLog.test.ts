import { describe, it, expect, beforeEach } from "vitest";
import { useCombatLog, recordsForCharacter } from "./combatLog";
import type { Combatant } from "@/types/combat";

const combatants: Combatant[] = [
  { id: "a", name: "Brunella", kind: "pc", initiative: 18, conditions: [], actions: {} },
];

beforeEach(() => useCombatLog.setState({ records: [] }));

describe("useCombatLog", () => {
  it("saves a record newest-first and filters by character", () => {
    useCombatLog.getState().save({ characterId: "c1", combatants, rounds: 1, endedAt: 1 });
    useCombatLog.getState().save({ characterId: "c2", combatants, rounds: 1, endedAt: 2 });
    const recs = useCombatLog.getState().records;
    expect(recs).toHaveLength(2);
    expect(recs[0].endedAt).toBe(2); // newest first
    expect(recordsForCharacter(recs, "c1")).toHaveLength(1);
  });

  it("attaches narration by id", () => {
    const rec = useCombatLog.getState().save({ characterId: "c1", combatants, rounds: 1, endedAt: 1 });
    useCombatLog.getState().setNarration(rec.id, "Canté la balada.");
    expect(useCombatLog.getState().records[0].narration).toBe("Canté la balada.");
  });

  it("removes by id", () => {
    const rec = useCombatLog.getState().save({ characterId: "c1", combatants, rounds: 1, endedAt: 1 });
    useCombatLog.getState().remove(rec.id);
    expect(useCombatLog.getState().records).toHaveLength(0);
  });

  it("merges records by id (union) without duplicating", () => {
    const rec = useCombatLog.getState().save({ characterId: "c1", combatants, rounds: 1, endedAt: 1 });
    useCombatLog.getState().mergeRecords([
      rec, // already present — no dup
      { ...rec, id: "new", endedAt: 5 },
    ]);
    const recs = useCombatLog.getState().records;
    expect(recs).toHaveLength(2);
    expect(recs[0].id).toBe("new"); // sorted newest first
  });
});
