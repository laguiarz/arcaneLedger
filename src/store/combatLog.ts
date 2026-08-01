import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CombatRecord } from "@/types/combatLog";
import { buildCombatRecord } from "@/lib/combatRecord";

interface SaveInput {
  characterId: string;
  combatants: CombatRecord["combatants"];
  rounds: number;
  endedAt: number;
  title?: string;
  narration?: string;
}

interface CombatLogState {
  records: CombatRecord[];
  /** Snapshot a finished combat and prepend it. Returns the new record. */
  save: (input: SaveInput) => CombatRecord;
  /** Attach (or replace) the cached narration on a record. */
  setNarration: (id: string, narration: string) => void;
  remove: (id: string) => void;
  /** Union-merge incoming records by id (for cloud pull); newest first. */
  mergeRecords: (incoming: CombatRecord[]) => void;
}

/** Records for one character, preserving newest-first order. Pure, reusable. */
export function recordsForCharacter(
  records: CombatRecord[],
  characterId: string,
): CombatRecord[] {
  return records.filter((r) => r.characterId === characterId);
}

/** Union two record lists by id (first-seen wins), sorted by endedAt desc. */
export function unionRecords(
  a: CombatRecord[],
  b: CombatRecord[],
): CombatRecord[] {
  const byId = new Map<string, CombatRecord>();
  for (const r of [...a, ...b]) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  return [...byId.values()].sort((x, y) => y.endedAt - x.endedAt);
}

export const useCombatLog = create<CombatLogState>()(
  persist(
    (set) => ({
      records: [],
      save: (input) => {
        const rec = buildCombatRecord(input);
        set((s) => ({ records: [rec, ...s.records] }));
        return rec;
      },
      setNarration: (id, narration) =>
        set((s) => ({
          records: s.records.map((r) => (r.id === id ? { ...r, narration } : r)),
        })),
      remove: (id) =>
        set((s) => ({ records: s.records.filter((r) => r.id !== id) })),
      mergeRecords: (incoming) =>
        set((s) => ({ records: unionRecords(s.records, incoming) })),
    }),
    { name: "arcanist-ledger:combat-log", version: 1 },
  ),
);
