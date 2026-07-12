import type { Combatant } from "@/types/combat";
import type { CombatRecord } from "@/types/combatLog";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/**
 * Pure: snapshot a finished combat into an immutable {@link CombatRecord}.
 * Combatants are deep-copied so the record never aliases the live combat store.
 */
export function buildCombatRecord(input: {
  characterId: string;
  combatants: Combatant[];
  rounds: number;
  endedAt: number;
  title?: string;
  narration?: string;
}): CombatRecord {
  return {
    id: newId(),
    characterId: input.characterId,
    endedAt: input.endedAt,
    title: input.title,
    rounds: Math.max(1, input.rounds),
    combatants: structuredClone(input.combatants),
    narration: input.narration,
  };
}
