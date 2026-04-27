import type {
  Ability,
  AbilityScores,
  Cantrip,
  Resource,
  Spell,
} from "@/types/character";

/**
 * Knowledge base for 2024 PHB feats whose mechanical grants the in-session
 * companion needs to surface — cantrips, innate leveled spells, and
 * at-will / limited-use abilities. The XML importer (Fight Club / GM5e)
 * stores feat benefits as one prose `<text>` blob, so we can't extract them
 * structurally; this registry is the bridge.
 *
 * To add a feat: add an entry whose key is the lowercase feat name with the
 * `[YYYY]` year stripped (use {@link normalizeFeatName}).
 */

export interface FeatGrants {
  cantrips?: Cantrip[];
  /** Leveled spells granted by the feat — routed to Character.innateSpells. */
  innateSpells?: Spell[];
  resources?: Resource[];
}

export interface FeatContext {
  abilities: AbilityScores;
  proficiencyBonus: number;
}

export function normalizeFeatName(raw: string): string {
  return raw.replace(/\s*\[(20\d{2})\]\s*$/u, "").trim().toLowerCase();
}

const ABILITY_LABEL: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

const mod = (score: number) => Math.floor((score - 10) / 2);

/**
 * Telekinetic feat (2024 PHB p. 208). Three variants — INT/WIS/CHA — each
 * grants the Mage Hand cantrip with enhancements + the Telekinetic Shove
 * bonus action. The chosen ability drives both Mage Hand's casting ability
 * and the Telekinetic Shove save DC.
 */
const telekineticGrants = (ability: Ability) => (ctx: FeatContext): FeatGrants => {
  const label = ABILITY_LABEL[ability];
  const dc = 8 + mod(ctx.abilities[ability]) + ctx.proficiencyBonus;
  return {
    cantrips: [
      {
        name: "Mage Hand",
        school: "Conjuration",
        source: "feat",
        castingTime: "Action",
        range: "60 feet",
        components: "(none — Telekinetic)",
        duration: "1 minute",
        desc:
          "A spectral, floating hand appears at a point you choose within range. " +
          "The hand can manipulate objects, open unlocked doors/containers, retrieve or stow items (≤10 lb), or pour contents out of a vial. " +
          "As a Bonus Action, you move the hand up to 30 ft. The hand vanishes if it's ever more than its max distance from you or after 1 minute.\n\n" +
          `Telekinetic feat enhancements: cast without Verbal or Somatic components; you can make the hand Invisible; range and the max distance from you are both increased by 30 ft (60 ft each). Spellcasting ability: ${label}.`,
      },
    ],
    resources: [
      {
        name: "Telekinetic Shove",
        source: "Feat: Telekinetic",
        desc:
          `Bonus Action. Telekinetically shove one creature you can see within 30 ft. ` +
          `Target makes a Strength saving throw (DC ${dc} = 8 + ${label} mod + PB); on a fail, it's moved 5 ft toward or away from you. At-will, no daily limit.`,
        max: 0,
        used: 0,
        recharge: "manual",
      },
    ],
  };
};

export const FEAT_REGISTRY: Record<string, (ctx: FeatContext) => FeatGrants> = {
  "telekinetic (intelligence)": telekineticGrants("int"),
  "telekinetic (wisdom)": telekineticGrants("wis"),
  "telekinetic (charisma)": telekineticGrants("cha"),
};
