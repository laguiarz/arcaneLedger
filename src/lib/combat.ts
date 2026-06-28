import type { Combatant, CombatantCondition } from "@/types/combat";

/**
 * Pure helpers for the combat tracker. Kept side-effect free so the store can
 * compose them and the test-suite can exercise the ordering / duration rules
 * without spinning up the React store.
 */

/**
 * Initiative order: highest initiative first. Combatants without an entered
 * initiative (`null`) sink to the bottom. Ties break by initiative bonus
 * (higher dex acts first — RAW-ish) and then alphabetically for stability.
 */
export function sortByInitiative(list: Combatant[]): Combatant[] {
  return [...list].sort((a, b) => {
    const ai = a.initiative ?? -Infinity;
    const bi = b.initiative ?? -Infinity;
    if (ai !== bi) return bi - ai;
    const ab = a.initiativeBonus ?? 0;
    const bb = b.initiativeBonus ?? 0;
    if (ab !== bb) return bb - ab;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Advance condition durations by one round: decrement every timed condition and
 * drop the ones that hit zero. Indefinite conditions (no `rounds`) are kept.
 */
export function tickConditions(
  conditions: CombatantCondition[],
): CombatantCondition[] {
  return conditions
    .map((c) =>
      c.rounds == null ? c : { ...c, rounds: c.rounds - 1 },
    )
    .filter((c) => c.rounds == null || c.rounds > 0);
}

/** Move the item at `index` by `dir` (-1 up / +1 down), returning a new array. */
export function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) {
    return list;
  }
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** d20 + bonus. `rng` is injectable so tests stay deterministic. */
export function rollInitiative(
  bonus = 0,
  rng: () => number = Math.random,
): number {
  return Math.floor(rng() * 20) + 1 + bonus;
}

let counter = 0;
/** Stable-ish id for a fresh combatant. */
export function newCombatantId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  counter += 1;
  return `combatant-${counter}`;
}
