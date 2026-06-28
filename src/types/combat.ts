import type { ConditionId } from "./character";

/**
 * Ephemeral combat-tracker types.
 *
 * Nothing here is persisted — a combat lives only for the duration of the
 * encounter and is wiped on reset. The single exception (the Gemini narration
 * config) lives separately in {@link "@/lib/combatNarration"}.
 */

export type CombatantKind = "pc" | "monster";

export interface CombatantCondition {
  id: ConditionId;
  /** First round (1-based) the condition applies — usually the active round. */
  fromRound: number;
  /**
   * Duration in rounds from `fromRound`. `undefined` means ongoing/indefinite
   * (applies from `fromRound` onward). A condition is active in round `r` when
   * `r >= fromRound && (rounds == null || r < fromRound + rounds)`.
   */
  rounds?: number;
}

export interface CombatantAction {
  /** Free-text description, e.g. "Bites Lyari", "casts Vicious Mockery". */
  text?: string;
  /** True once the combatant has acted this round (even with no detail typed). */
  acted: boolean;
}

export interface Combatant {
  id: string;
  name: string;
  kind: CombatantKind;
  /** Initiative roll total. `null` until the player enters it. */
  initiative: number | null;
  /** Initiative modifier — used for the optional auto-roll and tie-breaks. */
  initiativeBonus?: number;
  /** Optional HP tracking (mainly useful for monsters). */
  hp?: { current: number; max: number };
  ac?: number;
  conditions: CombatantCondition[];
  /** Per-round action log keyed by 1-based round number. */
  actions: Record<number, CombatantAction>;
  /** Library character id when this combatant is a loaded party member. */
  sourceId?: string;
}
