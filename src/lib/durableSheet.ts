import type {
  AbilityScores,
  ArmorConfig,
  Character,
} from "@/types/character";
import type { CustomSpells } from "@/lib/customSpells";

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
  /** Per-character AI narration prompt (each character its own voice). */
  narrationPrompt?: string;
  /**
   * Spells the player authored in-app. ALWAYS emitted, empty arrays included:
   * an empty list means "she has none", which is how a deletion reaches the
   * other devices. Absent means "pushed by a build that predates this field",
   * which `useCharacter.applyRemoteSheet` treats as "keep what I have".
   *
   * NOTE: adding this key changes `digestState` for every install, so the first
   * boot after it ships reads as dirty everywhere. Expected, one-time, and
   * harmless because nobody has custom spells yet at that moment.
   */
  customSpells: CustomSpells;
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
    narrationPrompt: c.narrationPrompt,
    customSpells: {
      spellbook: c.spellbook.filter((s) => s.source === "custom"),
      cantrips: c.cantrips.filter((s) => s.source === "custom"),
    },
  };
}

/**
 * Return a new character with the durable fields replaced by `d`, leaving all
 * volatile session state untouched. Current HP is clamped to the (possibly
 * lower) new max.
 *
 * Custom spells are NOT applied here — they live in a per-character stash on
 * the store, so `useCharacter.applyRemoteSheet` handles them.
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
    narrationPrompt: d.narrationPrompt,
    hp: {
      ...c.hp,
      max,
      current: Math.min(c.hp.current, max),
    },
  };
}
