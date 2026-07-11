import type { ArmorConfig, Character, DexToAc } from "@/types/character";
import { abilityMod, abilityScore } from "@/lib/abilities";

/** Dexterity's contribution to AC given the armor's Dex handling. */
export function dexAcContribution(mode: DexToAc, dexMod: number): number {
  switch (mode) {
    case "full":
      return dexMod;
    case "max2":
      return Math.min(2, dexMod);
    case "none":
      return 0;
  }
}

export const DEX_MODE_LABEL: Record<DexToAc, string> = {
  full: "Full Dex",
  max2: "Dex (max +2)",
  none: "No Dex",
};

/**
 * Effective Armor Class. Computed from {@link ArmorConfig} when present (so it
 * tracks Dexterity live); otherwise falls back to the flat `ac` number, or 10.
 */
export function armorClass(
  c: Character,
  opts?: { includeMagic?: boolean },
): number {
  if (!c.armor) return c.ac ?? 10;
  const dexMod = abilityMod(abilityScore(c, "dex", opts));
  return (
    c.armor.base +
    dexAcContribution(c.armor.dexMode, dexMod) +
    (c.armor.shield ? 2 : 0) +
    c.armor.miscBonus
  );
}

/**
 * Seed an ArmorConfig from a character that only has a flat `ac`. Assumes the
 * stored AC is light/no armor (full Dex, no shield) and back-solves the base so
 * the computed AC initially matches — an editable starting point, not a guess
 * at their real armor.
 */
export function defaultArmorConfig(c: Character): ArmorConfig {
  const dexMod = abilityMod(abilityScore(c, "dex"));
  const flat = c.ac ?? 10 + dexMod;
  return {
    base: flat - dexMod,
    dexMode: "full",
    shield: false,
    miscBonus: 0,
  };
}
