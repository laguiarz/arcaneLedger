import { describe, it, expect } from "vitest";
import type { Character, Resource } from "@/types/character";
import { itemBoundSpellNames } from "./itemSpells";

const res = (over: Partial<Resource>): Resource => ({
  name: "r",
  max: 0,
  used: 0,
  recharge: "manual",
  ...over,
});

function charWith(resources: Resource[]): Character {
  return { resources } as Character;
}

describe("itemBoundSpellNames", () => {
  it("collects every resource's item spell", () => {
    const c = charWith([
      res({ name: "Bow", itemSpell: { name: "Ensnaring Strike" } }),
      res({ name: "Book", itemSpell: { name: "Guiding Hand" } }),
    ]);
    expect(itemBoundSpellNames(c)).toEqual(
      new Set(["Ensnaring Strike", "Guiding Hand"]),
    );
  });

  it("ignores resources with no item spell", () => {
    expect(itemBoundSpellNames(charWith([res({ name: "Bardic" })])).size).toBe(0);
  });

  it("is empty for a character with no resources", () => {
    expect(itemBoundSpellNames(charWith([])).size).toBe(0);
  });

  it("dedupes two items bound to the same spell", () => {
    const c = charWith([
      res({ name: "Book", itemSpell: { name: "Guiding Hand" } }),
      res({ name: "Scroll", itemSpell: { name: "Guiding Hand" } }),
    ]);
    expect(itemBoundSpellNames(c).size).toBe(1);
  });
});
