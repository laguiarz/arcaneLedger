import { abilityMod, abilityScore } from "@/lib/abilities";
import type { Character, Weapon } from "@/types/character";

/**
 * Weapon attack and damage arithmetic, kept pure and out of the panel so it can
 * be tested without a DOM — the same split `armor.ts` uses for AC.
 *
 * The app never rolls an attack. It reports what you add to the physical d20.
 */

/** Signed display for a modifier: 3 -> "+3", -1 -> "-1". */
export function fmtBonus(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/**
 * The ability modifier driving this weapon. Goes through `abilityScore`, so
 * feat and magic bonuses to the score are already counted.
 */
function weaponAbilityMod(c: Character, w: Weapon): number {
  return abilityMod(abilityScore(c, w.ability));
}

/** To hit: ability + proficiency (only when proficient) + the weapon's magic bonus. */
export function weaponAttackBonus(c: Character, w: Weapon): number {
  return (
    weaponAbilityMod(c, w) +
    (w.proficient ? c.proficiencyBonus : 0) +
    (w.magicBonus ?? 0)
  );
}

/** Flat damage added to the dice: ability + magic bonus. Proficiency never applies. */
export function weaponDamageBonus(c: Character, w: Weapon): number {
  return weaponAbilityMod(c, w) + (w.magicBonus ?? 0);
}

/**
 * "1d8+5 Piercing". A zero bonus is omitted rather than printed as "+0", which
 * reads like a bug on a character sheet.
 */
export function weaponDamageLabel(c: Character, w: Weapon): string {
  const bonus = weaponDamageBonus(c, w);
  return `${w.damageDice}${bonus === 0 ? "" : fmtBonus(bonus)} ${w.damageType}`;
}
