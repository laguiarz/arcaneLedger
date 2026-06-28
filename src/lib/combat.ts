import type { Combatant, CombatantCondition } from "@/types/combat";

/**
 * Pure helpers for the combat tracker. Kept side-effect free so the store can
 * compose them and the test-suite can exercise the ordering / condition rules
 * without spinning up the React store.
 */

/** Initiative 0 is the convention for "sitting this fight out" / disabled. */
export function isInactive(c: Combatant): boolean {
  return c.initiative === 0;
}

/**
 * Initiative order: highest initiative first. Inactive combatants (initiative 0)
 * and those without an entered initiative (`null`) sink to the bottom. Ties
 * break by initiative bonus (higher dex acts first — RAW-ish) then name.
 */
export function sortByInitiative(list: Combatant[]): Combatant[] {
  const eff = (c: Combatant) =>
    c.initiative == null || c.initiative === 0 ? -Infinity : c.initiative;
  return [...list].sort((a, b) => {
    const ai = eff(a);
    const bi = eff(b);
    if (ai !== bi) return bi - ai;
    const ab = a.initiativeBonus ?? 0;
    const bb = b.initiativeBonus ?? 0;
    if (ab !== bb) return bb - ab;
    return a.name.localeCompare(b.name);
  });
}

/** Is a condition active in the given round, per its [fromRound, +rounds) window? */
export function conditionActiveInRound(
  c: CombatantCondition,
  round: number,
): boolean {
  if (round < c.fromRound) return false;
  if (c.rounds == null) return true;
  return round < c.fromRound + c.rounds;
}

/** The conditions on a combatant that are active in the given round. */
export function activeConditionsInRound(
  combatant: Combatant,
  round: number,
): CombatantCondition[] {
  return combatant.conditions.filter((c) => conditionActiveInRound(c, round));
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
