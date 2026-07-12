import type { Combatant } from "./combat";

/** An immutable snapshot of a finished combat, kept for the Chronicle log. */
export interface CombatRecord {
  /** Stable id — dedup key for the union merge in cloud sync. */
  id: string;
  /** Owning character (activeCharacterId at the time the fight ended). */
  characterId: string;
  /** ms epoch when the record was created. */
  endedAt: number;
  /** Optional player-supplied label; defaults derived from date in the UI. */
  title?: string;
  /** Rounds fought. */
  rounds: number;
  /** Snapshot of every combatant with their per-round actions + conditions. */
  combatants: Combatant[];
  /** Cached Brunella narration, if generated. */
  narration?: string;
}
