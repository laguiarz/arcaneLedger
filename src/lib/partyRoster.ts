import type { Character } from "@/types/character";

/**
 * The character plus their party, in display order — the roster used to preload
 * combat and to pick who carries a party magic item. Pure so it can be tested
 * without a DOM.
 */
export function partyRoster(c: Pick<Character, "name" | "party">): string[] {
  return [c.name, ...(c.party ?? [])]
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
}
