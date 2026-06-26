import type { Character, SkillName } from "@/types/character";
import { skillModifier } from "@/lib/skills";

/** Roll a single d20, returning a natural result in 1..20. `rng` is injectable for tests. */
export function rollD20(rng: () => number = Math.random): number {
  return Math.floor(rng() * 20) + 1;
}

export interface SkillCheckResult {
  natural: number;
  mod: number;
  total: number;
}

/**
 * Roll a normal (1d20) skill check: natural d20 + the skill's total modifier.
 * `rng` is injectable so callers/tests can produce deterministic results.
 */
export function rollSkillCheck(
  c: Character,
  skill: SkillName,
  rng: () => number = Math.random,
): SkillCheckResult {
  const natural = rollD20(rng);
  const mod = skillModifier(c, skill);
  return { natural, mod, total: natural + mod };
}
