import type { Ability, Character, SkillName } from "@/types/character";
import { abilityMod, abilityScore } from "@/lib/abilities";
import { SKILLS_IN_ORDER } from "@/lib/constants";

export { abilityMod };

/** Governing ability for a skill, sourced from the canonical SKILLS_IN_ORDER map. */
const SKILL_ABILITY: Record<SkillName, Ability> = Object.fromEntries(
  SKILLS_IN_ORDER.map((s) => [s.name, s.ability]),
) as Record<SkillName, Ability>;

/**
 * Bard Jack of All Trades (2024, class level 2+): add half proficiency bonus
 * (rounded down) to ability checks that don't already include proficiency.
 */
export function isJackOfAllTrades(c: Character): boolean {
  return c.className.trim().toLowerCase() === "bard" && c.level >= 2;
}

/**
 * Total modifier for a skill check:
 *   abilityMod + (expertise ? 2×PB : proficient ? 1×PB : JoAT ? floor(PB/2) : 0).
 * Expertise implies proficient. A missing skills entry → base ability mod
 * (plus Jack of All Trades if applicable).
 */
export function skillModifier(c: Character, skill: SkillName): number {
  const ability = SKILL_ABILITY[skill];
  const base = abilityMod(abilityScore(c, ability));
  const prof = c.skills?.[skill];
  if (prof?.expertise) return base + 2 * c.proficiencyBonus;
  if (prof?.proficient) return base + c.proficiencyBonus;
  if (isJackOfAllTrades(c)) return base + Math.floor(c.proficiencyBonus / 2);
  return base;
}

/** Passive Perception = 10 + Perception skill modifier. */
export function passivePerception(c: Character): number {
  return 10 + skillModifier(c, "perception");
}
