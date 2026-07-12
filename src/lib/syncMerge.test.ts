import { describe, it, expect } from "vitest";
import { mergeState, mergeCombats, type SyncedState } from "./syncMerge";
import type { CombatRecord } from "@/types/combatLog";

const state = (updatedAt: number, tag: string): SyncedState => ({
  updatedAt,
  sheet: { tag },
  coin: { tag },
});

const rec = (id: string, endedAt: number): CombatRecord => ({
  id,
  characterId: "c1",
  endedAt,
  rounds: 1,
  combatants: [],
});

describe("mergeState", () => {
  it("keeps the side with the larger updatedAt", () => {
    expect(mergeState(state(1, "local"), state(2, "remote"))?.sheet).toEqual({ tag: "remote" });
    expect(mergeState(state(5, "local"), state(2, "remote"))?.sheet).toEqual({ tag: "local" });
  });

  it("prefers local on a tie (avoids clobbering a fresh local edit)", () => {
    expect(mergeState(state(3, "local"), state(3, "remote"))?.sheet).toEqual({ tag: "local" });
  });

  it("handles nulls", () => {
    expect(mergeState(null, state(1, "remote"))?.sheet).toEqual({ tag: "remote" });
    expect(mergeState(state(1, "local"), null)?.sheet).toEqual({ tag: "local" });
    expect(mergeState(null, null)).toBeNull();
  });
});

describe("mergeCombats", () => {
  it("unions by id and sorts newest first", () => {
    const merged = mergeCombats([rec("a", 1), rec("b", 3)], [rec("b", 3), rec("c", 2)]);
    expect(merged.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("does not duplicate ids present on both sides", () => {
    const merged = mergeCombats([rec("a", 1)], [rec("a", 9)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].endedAt).toBe(1); // local (first-seen) wins
  });
});
