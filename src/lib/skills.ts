import type { Ability, Character, SkillName } from "@/types/character";
import { abilityMod } from "@/store/character";
import { SKILLS_IN_ORDER } from "@/lib/constants";

export { abilityMod };

/** Governing ability for a skill, sourced from the canonical SKILLS_IN_ORDER map. */
const SKILL_ABILITY: Record<SkillName, Ability> = Object.fromEntries(
  SKILLS_IN_ORDER.map((s) => [s.name, s.ability]),
) as Record<SkillName, Ability>;

/**
 * Total modifier for a skill check:
 *   abilityMod + (expertise ? 2×PB : proficient ? 1×PB : 0).
 * Expertise implies proficient. A missing skills entry → base ability mod only.
 */
export function skillModifier(c: Character, skill: SkillName): number {
  const ability = SKILL_ABILITY[skill];
  const base = abilityMod(c.abilities[ability]);
  const prof = c.skills?.[skill];
  if (prof?.expertise) return base + 2 * c.proficiencyBonus;
  if (prof?.proficient) return base + c.proficiencyBonus;
  return base;
}

/** Passive Perception = 10 + Perception skill modifier. */
export function passivePerception(c: Character): number {
  return 10 + skillModifier(c, "perception");
}
