export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type SpellLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type SpellSchool =
  | "Abjuration"
  | "Conjuration"
  | "Divination"
  | "Enchantment"
  | "Evocation"
  | "Illusion"
  | "Necromancy"
  | "Transmutation";

export type SpellSource =
  | "class"
  | "subclass"
  | "race"
  | "background"
  | "feat"
  | "item";

export interface SpellBase {
  name: string;
  school: SpellSchool;
  castingTime?: string;
  range?: string;
  components?: string;
  /**
   * Components removed by a class/subclass feature (e.g. Illusionist's
   * Improved Illusions strips V from Illusion spells). The base
   * `components` string is preserved so the modification stays visible —
   * the renderer shows these letters with strikethrough.
   */
  componentsStripped?: Array<"V" | "S" | "M">;
  duration?: string;
  desc?: string;
  /** Where this spell came from. Defaults to "class" when authored. */
  source?: SpellSource;
}

export interface Cantrip extends SpellBase {
  /** Cantrips are level 0 */
}

export interface Spell extends SpellBase {
  level: SpellLevel;
  ritual?: boolean;
  concentration?: boolean;
  upcastNote?: string;
  /**
   * For innate/racial spells: number of times the spell can be cast at its base
   * level without expending a slot, recovered on a long rest. (Per 2024 PHB,
   * lineage spells like High Elf Misty Step are 1/long rest.)
   */
  freeCastsPerLongRest?: number;
}

export type RechargeType = "long" | "short" | "dawn" | "manual";

export interface Resource {
  /** Stable id; defaults to name when authored */
  id?: string;
  name: string;
  source?: string; // "Wizard class", "Magic item", "Feat", "Race"...
  desc?: string;
  max: number;
  used: number;
  recharge: RechargeType;
  /**
   * If set, the resource shows a sparkle button that draws from the named
   * inspire-phrase deck (see src/data/inspirePhrases.ts). Phrases rotate
   * without repeating until the deck is exhausted.
   */
  inspirePhraseDeck?: string;
}

export type ConditionId =
  | "blinded"
  | "charmed"
  | "deafened"
  | "frightened"
  | "grappled"
  | "incapacitated"
  | "invisible"
  | "paralyzed"
  | "petrified"
  | "poisoned"
  | "prone"
  | "restrained"
  | "stunned"
  | "unconscious";

export interface ConditionsState {
  active: ConditionId[];
  /** Exhaustion 0–6 (5e 2014 rules) */
  exhaustion: number;
}

export interface ConcentrationState {
  spellName: string;
  level: SpellLevel;
  /** Combat rounds elapsed since concentration started. User-advanced. */
  rounds: number;
}

export type SpellSlots = Partial<Record<SpellLevel, number>>;

export interface HitPoints {
  max: number;
  current: number;
  temp: number;
}

export interface HitDice {
  /** Die size: 6 (Wizard/Sorcerer), 8 (most), 10 (martials), 12 (Barbarian). */
  die: number;
  /** Total dice in the pool — usually = character level. */
  max: number;
  /** Dice spent since last long rest. */
  spent: number;
}

export type AbilityScores = Record<Ability, number>;

export interface Character {
  name: string;
  className: string; // "Wizard"
  subclass?: string; // "School of Evocation"
  level: number;
  proficiencyBonus: number;
  abilities: AbilityScores;
  savingThrowProficiencies: Ability[];
  hp: HitPoints;
  hitDice: HitDice;
  ac?: number;
  initiativeBonus?: number;
  speed?: number;

  spellSaveDcOverride?: number;
  spellAttackBonusOverride?: number;
  spellcastingAbility?: Ability; // default: int

  spellSlotsMax: SpellSlots;
  spellSlots: SpellSlots; // current available
  cantrips: Cantrip[];
  spellbook: Spell[];
  preparedSpells: string[]; // names referencing spellbook
  /**
   * Spells granted by race/lineage/feat that are NOT in the spellbook.
   * They're always available (implicitly prepared) and may have free casts
   * via {@link Spell.freeCastsPerLongRest}.
   */
  innateSpells: Spell[];
  /** Free-cast usage counter keyed by spell name. Reset on long rest. */
  racialFreeCastsUsed: Record<string, number>;

  resources: Resource[];
  conditions: ConditionsState;
  concentration?: ConcentrationState | null;

  notes?: string;
}
