import type {
  AbilityScores,
  ArmorConfig,
  Character,
} from "@/types/character";

/**
 * The subset of a character that is a durable "sheet edit" worth syncing across
 * devices: ability scores, max HP, AC config, party, level, proficiency. Session
 * state (current HP, spell slots, resources, conditions, hit-dice spent,
 * concentration, racial free casts) is deliberately excluded — it resets per
 * rest / next session and must never travel between devices.
 */
export interface DurableSheet {
  abilities: AbilityScores;
  hpMax: number;
  /** Flat AC fallback (kept in step with the sheet). */
  ac?: number;
  /** Structured AC config, when the sheet has opted into it. */
  armor?: ArmorConfig;
  party: string[];
  level: number;
  proficiencyBonus: number;
}

/** Pull the durable fields out of a character. */
export function extractDurable(c: Character): DurableSheet {
  return {
    abilities: c.abilities,
    hpMax: c.hp.max,
    ac: c.ac,
    armor: c.armor,
    party: c.party ?? [],
    level: c.level,
    proficiencyBonus: c.proficiencyBonus,
  };
}

/**
 * Return a new character with the durable fields replaced by `d`, leaving all
 * volatile session state untouched. Current HP is clamped to the (possibly
 * lower) new max.
 */
export function applyDurable(c: Character, d: DurableSheet): Character {
  const max = Math.max(1, d.hpMax);
  return {
    ...c,
    abilities: d.abilities,
    ac: d.ac,
    armor: d.armor,
    party: d.party,
    level: d.level,
    proficiencyBonus: d.proficiencyBonus,
    hp: {
      ...c.hp,
      max,
      current: Math.min(c.hp.current, max),
    },
  };
}
