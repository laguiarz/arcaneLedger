import type { Character } from "@/types/character";

/**
 * Names of spells that are cast from an item's row rather than from the spell
 * lists.
 *
 * The Encounter view subtracts these from Innate Casting: left in, they would
 * render a second Cast button backed by spell slots — which, for a spell off
 * your class list, is a cast you cannot legally make.
 *
 * Pure and separate from the view so it can be tested without rendering the
 * whole Encounter page.
 */
export function itemBoundSpellNames(c: Character): Set<string> {
  return new Set(
    c.resources.flatMap((r) => (r.itemSpell ? [r.itemSpell.name] : [])),
  );
}
