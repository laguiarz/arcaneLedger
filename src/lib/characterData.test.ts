import { describe, it, expect } from "vitest";
import brunella from "../../public/characters/brunella.json";
import lyari from "../../public/characters/lyari.json";
import type { Character } from "@/types/character";
import { normalizeAbilities } from "./abilities";
import { weaponAttackBonus, weaponDamageLabel } from "./weapons";

/**
 * Tests against the REAL library JSON, not a fixture.
 *
 * A fixture can drift from the shipped file and stay green while the character
 * actually at the table is wrong — and these files are hand-edited, which is
 * exactly where a typo goes unnoticed. `loadCharacter` normalizes abilities on
 * the way in, so we do the same here.
 */
function load(raw: unknown): Character {
  const c = raw as Character;
  return { ...c, abilities: normalizeAbilities((raw as { abilities: unknown }).abilities) };
}

const CHARACTERS: Array<[string, Character]> = [
  ["brunella", load(brunella)],
  ["lyari", load(lyari)],
];

describe.each(CHARACTERS)("%s.json", (_name, c) => {
  it("references a real spell from every itemSpell", () => {
    for (const r of c.resources) {
      if (!r.itemSpell) continue;
      const found =
        c.spellbook.some((s) => s.name === r.itemSpell!.name) ||
        c.innateSpells.some((s) => s.name === r.itemSpell!.name);
      expect(found, `"${r.name}" points at a spell that does not exist`).toBe(true);
    }
  });

  it("names every resource uniquely", () => {
    // Every store action keys resources by name; two with the same name both
    // mutate on a single click.
    const names = c.resources.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("brunella's Enspelled Longbow", () => {
  const c = load(brunella);
  const bow = (c.weapons ?? []).find((w) => w.name === "Longbow +2");

  it("is on the sheet", () => {
    expect(bow).toBeDefined();
  });

  it("hits at +5 — Dex 17, no proficiency, +2 magic", () => {
    expect(weaponAttackBonus(c, bow!)).toBe(5);
  });

  it("deals 1d8+5 piercing", () => {
    expect(weaponDamageLabel(c, bow!)).toBe("1d8+5 Piercing");
  });

  it("carries 6 charges that come back on a d6", () => {
    const r = c.resources.find((x) => x.itemSpell?.name === "Ensnaring Strike");
    expect(r?.max).toBe(6);
    expect(r?.rechargeDice).toBe("1d6");
    expect(r?.recharge).toBe("dawn");
  });
});
