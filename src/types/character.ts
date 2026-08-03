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
  | "item"
  /** Authored in-app by the player. The only source the UI may edit or delete. */
  | "custom";

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

/** Combat action economy used by the Encounter quick filters. */
export type ActionType = "action" | "bonus" | "reaction";

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
   * Optional action economy for activated abilities/items, used by the
   * Encounter action filters. Omit for passive features (they only appear
   * under the "All" filter). Spells/cantrips are classified from castingTime
   * instead — see {@link "@/lib/actionType".classifyCastingTime}.
   */
  actionType?: ActionType;
  /**
   * If set, the resource shows a sparkle button that draws from the named
   * inspire-phrase deck (see src/data/inspirePhrases.ts). Phrases rotate
   * without repeating until the deck is exhausted.
   */
  inspirePhraseDeck?: string;

  /**
   * Dice rolled to regain charges at dawn, e.g. "1d6". Only meaningful with
   * `recharge: "dawn"`. Its presence is what stops a long rest refilling this
   * resource outright — rolling the die is the whole mechanic.
   */
  rechargeDice?: string;

  /**
   * A spell this item casts. One nested object rather than loose sibling
   * fields, so a DC cannot exist without a spell to belong to — and because
   * the DMG's enspelled-item table binds DC and attack bonus together.
   */
  itemSpell?: {
    /** Resolved with findSpell(), so it may live in innateSpells or the spellbook. */
    name: string;
    saveDc?: number;
    attackBonus?: number;
  };
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

/**
 * A single ability score, broken into its independent contributors so an
 * antimagic field (or a lost/attuned item) can strip exactly the right part.
 *   effective score = base + featBonus + magicBonus
 *
 * - `base`      original die roll / point-buy / standard-array value.
 * - `featBonus` permanent non-magical bumps: species/background, ASI, feats,
 *               class features. NOT removed by antimagic.
 * - `magicBonus` bonuses from magic items. Suppressed inside an antimagic
 *               field. Zero for everyone today — the split exists so it's ready.
 */
export interface AbilityBreakdown {
  base: number;
  featBonus: number;
  magicBonus: number;
}

export type AbilityScores = Record<Ability, AbilityBreakdown>;

/**
 * How Dexterity feeds Armor Class, per 2024/2014 armor rules:
 * - `full`  light armor / no armor / Unarmored Defense — add the whole Dex mod.
 * - `max2`  medium armor — add Dex mod, capped at +2.
 * - `none`  heavy armor — Dex doesn't apply.
 */
export type DexToAc = "full" | "max2" | "none";

export interface ArmorConfig {
  /** Armor's base AC: 10 unarmored, 11 leather, 14 chain shirt, 18 plate, … */
  base: number;
  dexMode: DexToAc;
  /** Shield equipped (+2). */
  shield: boolean;
  /** Everything else: rings/cloaks of protection, magic armor, styles, … */
  miscBonus: number;
}

/**
 * A weapon the character can attack with. Authored in the character JSON —
 * there is no in-app editor, so there is no `id`: nothing keys a weapon, and
 * React keys use `name + index` the way the resource lists already do.
 */
export interface Weapon {
  name: string;
  /** Which ability drives attack and damage. Ranged weapons use "dex". */
  ability: Ability;
  /** Whether the character's proficiency bonus applies. */
  proficient: boolean;
  /** A +N weapon: added to BOTH the attack roll and the damage. */
  magicBonus?: number;
  /** Damage dice as authored, e.g. "1d8". Never parsed — displayed only. */
  damageDice: string;
  /** e.g. "Piercing". */
  damageType: string;
  /** e.g. "150/600 ft". Free text. */
  range?: string;
  /** e.g. ["Ammunition", "Heavy", "Two-Handed"]. Displayed, never interpreted. */
  properties?: string[];
  /** Free text shown under the weapon, e.g. an enspelled note. */
  note?: string;
}

export type SkillName =
  | "athletics" // STR
  | "acrobatics"
  | "sleightOfHand"
  | "stealth" // DEX
  | "arcana"
  | "history"
  | "investigation"
  | "nature"
  | "religion" // INT
  | "animalHandling"
  | "insight"
  | "medicine"
  | "perception"
  | "survival" // WIS
  | "deception"
  | "intimidation"
  | "performance"
  | "persuasion"; // CHA

export interface SkillProficiency {
  proficient?: boolean;
  /** Expertise implies proficient and adds 2× proficiency bonus. */
  expertise?: boolean;
}

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
  /**
   * Flat Armor Class. Used as a fallback / legacy value when {@link armor} is
   * not configured (e.g. library JSON and XML imports author a plain number).
   * When `armor` is present, AC is computed from it instead — see
   * `armorClass()` in @/lib/armor.
   */
  ac?: number;
  /**
   * Structured AC so it tracks Dexterity (and armor/shield/misc) live. Optional
   * and opt-in: absent for imported characters until the sheet configures it.
   */
  armor?: ArmorConfig;
  /**
   * Weapons. Optional and frequently `undefined` — sampleWizard and the XML
   * importer never set it, and every store persisted before this field lacks
   * it. Always read as `c.weapons ?? []`.
   */
  weapons?: Weapon[];
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

  /**
   * Names of the other party members this character adventures with. Stored on
   * the sheet (the simple option for now) so the Combat tracker can preload the
   * whole group's initiative rows. Just names today; some day this becomes a
   * proper party assembled from a character roster.
   */
  party?: string[];

  /**
   * Per-skill proficiency/expertise. Optional and additive — missing entries
   * are treated as not proficient (base ability modifier only). Authored in
   * curated library JSON; not parsed from Fight Club XML imports.
   */
  skills?: Partial<Record<SkillName, SkillProficiency>>;

  notes?: string;

  /**
   * Per-character system prompt for the AI combat narration ("Brunella's
   * chronicle"). Optional: when absent, the narration falls back to
   * {@link "@/lib/combatNarration".DEFAULT_NARRATION_PROMPT}. Editable from the
   * narration modal and synced as a durable sheet field so each character keeps
   * its own narrative voice across devices.
   */
  narrationPrompt?: string;
}
