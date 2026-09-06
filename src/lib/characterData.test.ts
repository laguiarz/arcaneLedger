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

  // A DM rule in this campaign gives every elf proficiency with the longbow and
  // the longsword, which a Bard would not otherwise have. It is a house rule, so
  // nothing in the class data implies it — pin it here or a future edit silently
  // drops 3 points off every shot.
  it("is proficient, per the campaign's elf weapon rule", () => {
    expect(bow!.proficient).toBe(true);
  });

  it("hits at +8 — Dex 17, proficiency +3, +2 magic", () => {
    expect(weaponAttackBonus(c, bow!)).toBe(8);
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

describe("brunella's Ritual-Grimoire", () => {
  const c = load(brunella);
  const rows = c.resources.filter((r) => r.source === "Ritual-Grimoire");

  it("has one row per ritual", () => {
    expect(rows.map((r) => r.name).sort()).toEqual(["Guiding Hand", "Wild Cunning"]);
  });

  it("carries no charges", () => {
    for (const r of rows) expect(r.max).toBe(0);
  });

  it("points at spells flagged as rituals", () => {
    for (const r of rows) {
      const s = c.innateSpells.find((x) => x.name === r.itemSpell!.name);
      expect(s?.ritual, `${r.name} is not flagged as a ritual`).toBe(true);
    }
  });

  it("keeps Guiding Hand's concentration and leaves Wild Cunning without it", () => {
    const gh = c.innateSpells.find((s) => s.name === "Guiding Hand");
    const wc = c.innateSpells.find((s) => s.name === "Wild Cunning");
    expect(gh?.concentration).toBe(true);
    expect(wc?.concentration).toBeUndefined();
  });

  it("authors no save DC, because neither spell has a saving throw", () => {
    for (const r of rows) expect(r.itemSpell?.saveDc).toBeUndefined();
  });
});

describe("brunella at Bard 6", () => {
  const c = load(brunella);

  it("is level 6 with 33 HP and six hit dice", () => {
    expect(c.level).toBe(6);
    expect(c.hp.max).toBe(33);
    expect(c.hitDice.max).toBe(6);
  });

  it("has 4/3/3 spell slots", () => {
    expect(c.spellSlotsMax).toEqual({ 1: 4, 2: 3, 3: 3 });
  });

  // The Bard table gives 10 prepared spells at level 6. Magical Discoveries
  // (Lore L6) adds two more that are ALWAYS prepared and do NOT count against
  // that 10 — so the list is 12 long by design. Anyone "fixing" it back to 10
  // would be silently unpreparing a spell she is entitled to.
  it("prepares 10 bard spells plus the two Magical Discoveries", () => {
    const discoveries = c.spellbook.filter((s) => s.source === "subclass");
    expect(discoveries.map((s) => s.name).sort()).toEqual(["Moonbeam", "Revivify"]);
    expect(c.preparedSpells).toHaveLength(10 + discoveries.length);
    for (const s of discoveries) expect(c.preparedSpells).toContain(s.name);
  });

  it("keeps every prepared spell resolvable in the spellbook", () => {
    const known = new Set(c.spellbook.map((s) => s.name));
    for (const n of c.preparedSpells) expect(known, `${n} is prepared but unknown`).toContain(n);
  });
});
