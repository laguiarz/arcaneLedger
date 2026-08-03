import type {
  Cantrip,
  Character,
  Spell,
  SpellLevel,
  SpellSchool,
} from "@/types/character";

/**
 * The spells the player authored herself, for ONE character. Kept outside the
 * `Character` object because every load replaces that object wholesale — see
 * the `customSpells` stash on `useCharacter`.
 */
export interface CustomSpells {
  spellbook: Spell[];
  cantrips: Cantrip[];
}

export const emptyCustomSpells = (): CustomSpells => ({ spellbook: [], cantrips: [] });

/** What the spell form collects. `level: 0` means "cantrip". */
export interface CustomSpellDraft {
  name: string;
  level: 0 | SpellLevel;
  school: SpellSchool;
  castingTime?: string;
  range?: string;
  components?: string;
  duration?: string;
  desc?: string;
  ritual?: boolean;
  concentration?: boolean;
}

export function isCantripDraft(d: CustomSpellDraft): boolean {
  return d.level === 0;
}

/**
 * Drop undefined, empty-string and false fields so a spell built from a draft
 * is shaped like the hand-authored ones in the library JSON rather than
 * carrying a pile of empty keys.
 */
function compact<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== false),
  ) as T;
}

function commonFields(d: CustomSpellDraft) {
  return {
    name: d.name.trim(),
    school: d.school,
    castingTime: d.castingTime?.trim(),
    range: d.range?.trim(),
    components: d.components?.trim(),
    duration: d.duration?.trim(),
    desc: d.desc?.trim(),
    source: "custom" as const,
  };
}

export function draftToSpell(d: CustomSpellDraft): Spell {
  return compact({
    ...commonFields(d),
    level: (d.level === 0 ? 1 : d.level) as SpellLevel,
    ritual: d.ritual,
    concentration: d.concentration,
  }) as Spell;
}

export function draftToCantrip(d: CustomSpellDraft): Cantrip {
  // `ritual`, `concentration` and `level` are deliberately absent: `Cantrip`
  // has no such fields, and level 0 is expressed by living in `cantrips`.
  return compact(commonFields(d)) as Cantrip;
}

/**
 * Replace the character's custom entries with the stash's. Pure and idempotent:
 * every write path (add, edit, delete, load, remote apply) goes through it, so
 * the projection can never drift from the stash.
 *
 * Deliberately does NOT sort. `Spellbook.tsx` already sorts the spellbook with
 * its own comparator and the cantrip grid renders in array order; sorting here
 * would reorder library content on a pull for no gain.
 */
export function projectCustoms(c: Character, stash: CustomSpells): Character {
  return {
    ...c,
    spellbook: [...c.spellbook.filter((s) => s.source !== "custom"), ...stash.spellbook],
    cantrips: [...c.cantrips.filter((s) => s.source !== "custom"), ...stash.cantrips],
  };
}

/**
 * Drop stash entries whose name the incoming sheet now provides itself. This is
 * what makes manual promotion work: once Fireball is committed to the library
 * JSON, the library copy wins and the duplicate custom disappears for good.
 */
export function pruneCustoms(c: Character, stash: CustomSpells): CustomSpells {
  const owned = new Set(
    [...c.spellbook, ...c.cantrips, ...c.innateSpells]
      .filter((s) => s.source !== "custom")
      .map((s) => s.name.trim().toLowerCase()),
  );
  const keep = (s: { name: string }) => !owned.has(s.name.trim().toLowerCase());
  return { spellbook: stash.spellbook.filter(keep), cantrips: stash.cantrips.filter(keep) };
}

/**
 * Is `name` already taken anywhere on the sheet? Name is the identity key for
 * `preparedSpells`, `findSpell` and concentration, so duplicates are refused.
 * `ignore` is the original name when renaming.
 */
export function nameCollides(c: Character, name: string, ignore?: string): boolean {
  const needle = name.trim().toLowerCase();
  const skip = ignore?.trim().toLowerCase();
  if (needle === skip) return false;
  return [...c.spellbook, ...c.cantrips, ...c.innateSpells].some(
    (s) => s.name.trim().toLowerCase() === needle,
  );
}
