import { describe, it, expect } from "vitest";
import {
  projectCustoms,
  pruneCustoms,
  nameCollides,
  emptyCustomSpells,
  draftToSpell,
  draftToCantrip,
  isCantripDraft,
} from "./customSpells";
import { sampleWizard } from "@/data/sampleWizard";
import type { Character, Spell, Cantrip } from "@/types/character";

const fireball: Spell = { name: "Fireball", level: 3, school: "Evocation", source: "custom" };
const spark: Cantrip = { name: "Spark", school: "Evocation", source: "custom" };

function base(overrides: Partial<Character> = {}): Character {
  return {
    ...sampleWizard,
    spellbook: [{ name: "Shield", level: 1, school: "Abjuration", source: "class" }],
    cantrips: [{ name: "Fire Bolt", school: "Evocation", source: "class" }],
    innateSpells: [],
    preparedSpells: [],
    ...overrides,
  };
}

describe("projectCustoms", () => {
  it("appends the stash and keeps library entries untouched and in order", () => {
    const next = projectCustoms(base(), { spellbook: [fireball], cantrips: [spark] });
    expect(next.spellbook.map((s) => s.name)).toEqual(["Shield", "Fireball"]);
    expect(next.cantrips.map((s) => s.name)).toEqual(["Fire Bolt", "Spark"]);
  });

  it("is idempotent — reprojecting does not duplicate", () => {
    const stash = { spellbook: [fireball], cantrips: [spark] };
    const once = projectCustoms(base(), stash);
    const twice = projectCustoms(once, stash);
    expect(twice.spellbook.map((s) => s.name)).toEqual(["Shield", "Fireball"]);
    expect(twice.cantrips.map((s) => s.name)).toEqual(["Fire Bolt", "Spark"]);
  });

  it("drops custom entries that are no longer in the stash", () => {
    const projected = projectCustoms(base(), { spellbook: [fireball], cantrips: [] });
    const cleared = projectCustoms(projected, emptyCustomSpells());
    expect(cleared.spellbook.map((s) => s.name)).toEqual(["Shield"]);
  });
});

describe("pruneCustoms", () => {
  it("drops a stash entry the incoming sheet now provides itself (promotion)", () => {
    const incoming = base({
      spellbook: [
        { name: "Shield", level: 1, school: "Abjuration", source: "class" },
        { name: "fireball", level: 3, school: "Evocation", source: "class" },
      ],
    });
    const pruned = pruneCustoms(incoming, { spellbook: [fireball], cantrips: [spark] });
    expect(pruned.spellbook).toHaveLength(0);
    expect(pruned.cantrips.map((s) => s.name)).toEqual(["Spark"]);
  });

  it("keeps entries the incoming sheet does not have", () => {
    const pruned = pruneCustoms(base(), { spellbook: [fireball], cantrips: [] });
    expect(pruned.spellbook.map((s) => s.name)).toEqual(["Fireball"]);
  });
});

describe("nameCollides", () => {
  const c = base({ innateSpells: [{ name: "Misty Step", level: 2, school: "Conjuration" }] });

  it("catches spellbook, cantrip and innate names, ignoring case", () => {
    expect(nameCollides(c, "shield")).toBe(true);
    expect(nameCollides(c, "FIRE BOLT")).toBe(true);
    expect(nameCollides(c, "Misty Step")).toBe(true);
  });

  it("is false for a free name", () => {
    expect(nameCollides(c, "Fireball")).toBe(false);
  });

  it("ignores the spell being renamed", () => {
    expect(nameCollides(c, "Shield", "Shield")).toBe(false);
  });
});

describe("drafts", () => {
  it("routes level 0 to a cantrip and drops leveled-only fields", () => {
    const draft = {
      name: "  Spark  ",
      level: 0 as const,
      school: "Evocation" as const,
      ritual: true,
      concentration: true,
      desc: "zap",
    };
    expect(isCantripDraft(draft)).toBe(true);
    const cantrip = draftToCantrip(draft);
    expect(cantrip.name).toBe("Spark");
    expect(cantrip.source).toBe("custom");
    expect(cantrip).not.toHaveProperty("ritual");
    expect(cantrip).not.toHaveProperty("level");
  });

  it("keeps ritual and concentration on a leveled spell and omits empty strings", () => {
    const spell = draftToSpell({
      name: "Fireball",
      level: 3,
      school: "Evocation",
      ritual: true,
      concentration: false,
      range: "",
      desc: "boom",
    });
    expect(spell).toEqual({
      name: "Fireball",
      level: 3,
      school: "Evocation",
      source: "custom",
      ritual: true,
      desc: "boom",
    });
  });
});
