/**
 * The legal range for a dice-recharge entry like "1d6".
 *
 * Sized from both halves on purpose: "2d6" is 2..12, and a rule that only read
 * the right-hand side would wrongly accept 1 and reject 12.
 *
 * Returns `null` for anything it cannot size — "d6", "1d6+1", garbage — and the
 * caller then imposes no upper bound, matching how the hit-dice input in the
 * Rest menu already behaves.
 */
export function parseRechargeDice(
  dice: string,
): { min: number; max: number } | null {
  const m = /^(\d+)d(\d+)$/.exec(dice.trim());
  if (!m) return null;
  const count = Number(m[1]);
  const sides = Number(m[2]);
  if (count < 1 || sides < 1) return null;
  return { min: count, max: count * sides };
}
