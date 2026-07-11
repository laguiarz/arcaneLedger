import type {
  Ability,
  AbilityBreakdown,
  AbilityScores,
  Character,
} from "@/types/character";

/** The six ability keys in canonical STR→CHA order. */
export const ABILITY_KEYS: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

/** D&D 5e ability modifier from a raw score. */
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Build a breakdown from a plain base value (feat/magic default to 0). */
export function makeBreakdown(
  base: number,
  featBonus = 0,
  magicBonus = 0,
): AbilityBreakdown {
  return { base, featBonus, magicBonus };
}

/** Sum of a single breakdown. `includeMagic: false` models an antimagic field. */
export function effectiveScore(
  b: AbilityBreakdown,
  includeMagic = true,
): number {
  return b.base + b.featBonus + (includeMagic ? b.magicBonus : 0);
}

/** Effective score for one of a character's abilities. */
export function abilityScore(
  c: Character,
  ability: Ability,
  opts?: { includeMagic?: boolean },
): number {
  return effectiveScore(c.abilities[ability], opts?.includeMagic ?? true);
}

/** Convert a plain `{str:8,...}` record into full breakdowns (feat/magic 0). */
export function toAbilityScores(plain: Record<Ability, number>): AbilityScores {
  return ABILITY_KEYS.reduce((acc, key) => {
    acc[key] = makeBreakdown(plain[key] ?? 10);
    return acc;
  }, {} as AbilityScores);
}

/**
 * Coerce any persisted / authored `abilities` blob into the breakdown shape.
 * Tolerates the old flat-number format (`{str: 16}`), partial breakdowns
 * (`{str: {base: 16}}`), and missing abilities (defaults to 10). This is what
 * lets library JSON and hand-edited files keep authoring plain numbers.
 */
export function normalizeAbilities(raw: unknown): AbilityScores {
  const src = (raw ?? {}) as Record<string, unknown>;
  return ABILITY_KEYS.reduce((acc, key) => {
    const v = src[key];
    if (typeof v === "number") {
      acc[key] = makeBreakdown(v);
    } else if (v && typeof v === "object") {
      const o = v as Partial<AbilityBreakdown>;
      acc[key] = {
        base: typeof o.base === "number" ? o.base : 10,
        featBonus: typeof o.featBonus === "number" ? o.featBonus : 0,
        magicBonus: typeof o.magicBonus === "number" ? o.magicBonus : 0,
      };
    } else {
      acc[key] = makeBreakdown(10);
    }
    return acc;
  }, {} as AbilityScores);
}
