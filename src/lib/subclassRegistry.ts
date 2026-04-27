import type {
  AbilityScores,
  Cantrip,
  Resource,
  Spell,
  SpellSchool,
} from "@/types/character";

/**
 * Knowledge base for class subclass features. Mirrors {@link FEAT_REGISTRY}
 * but keyed by `${className}:${subclass}` (lowercase) and gated by character
 * level — subclass features unlock at L3, L6, L10, L14.
 *
 * Phase 1: Wizard 2024 Illusionist L3 (Improved Illusions). See
 * SUBCLASS_FEATURES_DESIGN.md for the full plan.
 */

export type StripComponent = "V" | "S" | "M";

export interface SchoolModifier {
  school: SpellSchool;
  /** Adds " + N feet" to range strings whose leading number is >= rangeMinFeet. */
  rangeBonus?: number;
  /** Default 10. Ranges below (and "Self"/"Touch") are skipped. */
  rangeMinFeet?: number;
  /** Components to add to Spell.componentsStripped (rendered struck through). */
  stripComponents?: StripComponent[];
}

export interface SubclassGrants {
  cantrips?: Cantrip[];
  innateSpells?: Spell[];
  resources?: Resource[];
  /**
   * Per-name patches for specific cantrips already on the character.
   * If `addIfMissing` is provided and no matching cantrip exists, it's
   * added first; the patch + appendDesc still apply on top.
   */
  modifyCantrip?: Array<{
    name: string;
    patch: Partial<Cantrip>;
    appendDesc?: string;
    addIfMissing?: Cantrip;
  }>;
  /** Per-name patches for specific spells already in spellbook or innate list. */
  modifySpell?: Array<{
    name: string;
    patch: Partial<Spell>;
    appendDesc?: string;
    addIfMissing?: Spell;
  }>;
  /** School-wide rules applied to every cantrip/spell of the named school. */
  schoolModifiers?: SchoolModifier[];
}

export interface SubclassContext {
  abilities: AbilityScores;
  proficiencyBonus: number;
  /** Class level — drives which features are active. */
  level: number;
}

export function subclassRegistryKey(className: string, subclass: string): string {
  return `${className.trim().toLowerCase()}:${subclass.trim().toLowerCase()}`;
}

/**
 * Wizard 2024 — School of Illusion.
 * - L3 Improved Illusions: strips V from Illusion spells, +60 ft to ranges
 *   ≥ 10 ft, Minor Illusion gains Bonus Action + sound&image. (Illusion
 *   Savant — build-time spellbook bonus — is intentionally not surfaced;
 *   it's not session-relevant.)
 */
const wizardIllusionist = (ctx: SubclassContext): SubclassGrants => {
  if (ctx.level < 3) return {};
  return {
    modifyCantrip: [
      {
        name: "Minor Illusion",
        // Override source even if FC5 imported it under a different tag —
        // RAW it's granted by the subclass.
        patch: { castingTime: "Bonus Action", source: "subclass" },
        appendDesc:
          "Improved Illusions (Illusionist L3): a single casting creates both a sound AND an image; cast as a Bonus Action.",
        // RAW: "you always know Minor Illusion" — add it if not already on
        // the character. patch + appendDesc still overlay on top.
        addIfMissing: {
          name: "Minor Illusion",
          school: "Illusion",
          castingTime: "Action",
          range: "30 feet",
          components: "S, M (a bit of fleece)",
          duration: "1 minute",
          source: "subclass",
          desc:
            "You create a sound or an image of an object within range that lasts for the duration. The illusion also ends if you dismiss it as an action or cast this spell again.\n\n" +
            "If you create a sound, its volume can range from a whisper to a scream. It can be your voice, someone else's voice, a lion's roar, drums beating, or any other sound you choose. The sound continues unabated throughout the duration, or you can make discrete sounds at different times before the spell ends.\n\n" +
            "If you create an image of an object—such as a chair, muddy footprints, or a small chest—it must be no larger than a 5-foot Cube. The image can't create sound, light, smell, or any other sensory effect. Physical interaction with the image reveals it to be an illusion, because things can pass through it.\n\n" +
            "If a creature uses its action to examine the sound or image, the creature can determine that it is an illusion with a successful Intelligence (Investigation) check against your spell save DC. If a creature discerns the illusion for what it is, the illusion becomes faint to the creature.",
        },
      },
    ],
    schoolModifiers: [
      {
        school: "Illusion",
        rangeBonus: 60,
        rangeMinFeet: 10,
        stripComponents: ["V"],
      },
    ],
    resources: [
      {
        name: "Improved Illusions",
        source: "Subclass: Illusionist",
        desc:
          "Passive (Illusionist L3): Illusion spells lose their Verbal component and gain +60 ft of range when their range is 10 ft or more. " +
          "You always know Minor Illusion (doesn't count against cantrips known); a single casting of Minor Illusion creates both sound AND an image, and it's cast as a Bonus Action.",
        max: 0,
        used: 0,
        recharge: "manual",
      },
    ],
  };
};

export const SUBCLASS_REGISTRY: Record<string, (ctx: SubclassContext) => SubclassGrants> = {
  "wizard:illusionist": wizardIllusionist,
};
