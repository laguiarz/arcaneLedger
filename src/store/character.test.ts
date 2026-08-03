import { describe, it, expect, beforeEach } from "vitest";
import type { Character, Spell } from "@/types/character";
import {
  availableRituals,
  preparedNonRituals,
  preparedRituals,
  ritualsNeedingPreparation,
  useCharacter,
} from "@/store/character";
import { toAbilityScores } from "@/lib/abilities";
import { extractDurable } from "@/lib/durableSheet";

const ritualPrepared: Spell = {
  name: "Detect Magic", level: 1, school: "Divination", ritual: true,
};
const ritualUnprepared: Spell = {
  name: "Illusory Script", level: 1, school: "Illusion", ritual: true,
};
const nonRitual: Spell = {
  name: "Magic Missile", level: 1, school: "Evocation",
};

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    name: "Test",
    className: "Wizard",
    level: 5,
    proficiencyBonus: 3,
    abilities: toAbilityScores({ str: 10, dex: 14, con: 12, int: 16, wis: 13, cha: 8 }),
    savingThrowProficiencies: [],
    hp: { max: 20, current: 20, temp: 0 },
    hitDice: { die: 6, max: 5, spent: 0 },
    spellSlotsMax: {},
    spellSlots: {},
    cantrips: [],
    spellbook: [ritualPrepared, ritualUnprepared, nonRitual],
    preparedSpells: ["Detect Magic"],
    innateSpells: [],
    racialFreeCastsUsed: {},
    resources: [],
    conditions: { active: [], exhaustion: 0 },
    concentration: null,
    ...overrides,
  };
}

describe("availableRituals", () => {
  it("returns every spellbook ritual for a Wizard (Ritual Adept)", () => {
    const names = availableRituals(makeChar()).map((s) => s.name);
    expect(names).toEqual(["Detect Magic", "Illusory Script"]);
  });

  it("returns only prepared rituals for a non-Wizard (e.g. Bard)", () => {
    const names = availableRituals(makeChar({ className: "Bard" })).map((s) => s.name);
    expect(names).toEqual(["Detect Magic"]);
  });

  it("never returns non-ritual spells", () => {
    const names = availableRituals(makeChar()).map((s) => s.name);
    expect(names).not.toContain("Magic Missile");
  });
});

describe("availableRituals and innate rituals", () => {
  const innateRitual: Spell = {
    name: "Guiding Hand", level: 1, school: "Divination", ritual: true, source: "item",
  };
  const innateNonRitual: Spell = {
    name: "Misty Step", level: 2, school: "Conjuration", source: "race",
  };

  it("includes innate rituals for a non-Wizard", () => {
    // There is no preparation step for a spell you never prepared, so a ritual
    // granted by lineage, a feat or an item is always available.
    const names = availableRituals(
      makeChar({
        className: "Bard",
        spellbook: [],
        preparedSpells: [],
        innateSpells: [innateRitual],
      }),
    ).map((s) => s.name);
    expect(names).toEqual(["Guiding Hand"]);
  });

  it("still hides an unprepared spellbook ritual from a non-Wizard", () => {
    const names = availableRituals(
      makeChar({
        className: "Bard",
        preparedSpells: [],
        innateSpells: [innateRitual],
      }),
    ).map((s) => s.name);
    expect(names).not.toContain("Illusory Script");
    expect(names).toContain("Guiding Hand");
  });

  it("gives a Wizard every spellbook ritual plus the innate ones", () => {
    const names = availableRituals(makeChar({ innateSpells: [innateRitual] })).map(
      (s) => s.name,
    );
    expect(names).toEqual(["Detect Magic", "Illusory Script", "Guiding Hand"]);
  });

  it("ignores innate spells that are not rituals", () => {
    const names = availableRituals(
      makeChar({ className: "Bard", innateSpells: [innateNonRitual] }),
    ).map((s) => s.name);
    expect(names).not.toContain("Misty Step");
  });
});

describe("setMaxHp", () => {
  it("raises the max and leaves current HP alone", () => {
    useCharacter.setState({ character: makeChar() });
    useCharacter.getState().setMaxHp(50);
    const hp = useCharacter.getState().character.hp;
    expect(hp.max).toBe(50);
    expect(hp.current).toBe(20);
  });

  it("clamps current HP down when the new max is lower", () => {
    useCharacter.setState({ character: makeChar() });
    useCharacter.getState().setMaxHp(10);
    const hp = useCharacter.getState().character.hp;
    expect(hp.max).toBe(10);
    expect(hp.current).toBe(10);
  });

  it("never goes below 1", () => {
    useCharacter.setState({ character: makeChar() });
    useCharacter.getState().setMaxHp(0);
    expect(useCharacter.getState().character.hp.max).toBe(1);
    useCharacter.getState().setMaxHp(-5);
    expect(useCharacter.getState().character.hp.max).toBe(1);
  });
});

describe("setNarrationPrompt", () => {
  it("stores a per-character prompt and clears back to undefined when emptied", () => {
    useCharacter.setState({ character: makeChar() });
    useCharacter.getState().setNarrationPrompt("Narrá con ironía.");
    expect(useCharacter.getState().character.narrationPrompt).toBe("Narrá con ironía.");

    // Blank input clears it (falls back to the default at read time).
    useCharacter.getState().setNarrationPrompt("   ");
    expect(useCharacter.getState().character.narrationPrompt).toBeUndefined();
  });
});

/**
 * The origin fields decide whether the header offers to reload from the library,
 * and until now nothing pinned them. The setter keys off the PRESENCE of
 * `sourceId`, which is easy to break by accident.
 */
describe("loadCharacter origin tracking", () => {
  it("records both the source and the revision for a library pick", () => {
    useCharacter
      .getState()
      .loadCharacter(makeChar(), { sourceId: "brunella", revision: "abc" });
    expect(useCharacter.getState().activeCharacterId).toBe("brunella");
    expect(useCharacter.getState().libraryRevision).toBe("abc");
  });

  it("leaves the revision null when the manifest had none", () => {
    useCharacter.getState().loadCharacter(makeChar(), { sourceId: "lyari" });
    expect(useCharacter.getState().activeCharacterId).toBe("lyari");
    expect(useCharacter.getState().libraryRevision).toBeNull();
  });

  it("marks an import custom and clears the previous revision", () => {
    useCharacter
      .getState()
      .loadCharacter(makeChar(), { sourceId: "brunella", revision: "abc" });
    useCharacter.getState().loadCharacter(makeChar());
    expect(useCharacter.getState().activeCharacterId).toBe("custom");
    // Otherwise the header would compare an imported sheet against someone
    // else's library entry.
    expect(useCharacter.getState().libraryRevision).toBeNull();
  });

  it("clears both when resetting to the sample", () => {
    useCharacter
      .getState()
      .loadCharacter(makeChar(), { sourceId: "brunella", revision: "abc" });
    useCharacter.getState().resetToSample();
    expect(useCharacter.getState().activeCharacterId).toBe("sample");
    expect(useCharacter.getState().libraryRevision).toBeNull();
  });
});

describe("addCustomSpell", () => {
  beforeEach(() => {
    useCharacter.setState({
      character: makeChar({
        spellbook: [{ name: "Shield", level: 1, school: "Abjuration", source: "class" }],
        cantrips: [{ name: "Fire Bolt", school: "Evocation", source: "class" }],
        innateSpells: [{ name: "Misty Step", level: 2, school: "Conjuration" }],
        preparedSpells: [],
      }),
      activeCharacterId: "lyari",
      customSpells: {},
    });
  });

  it("puts a leveled spell in the spellbook and the stash, tagged custom", () => {
    const res = useCharacter.getState().addCustomSpell({
      name: "Fireball", level: 3, school: "Evocation",
    });
    expect(res.ok).toBe(true);
    const s = useCharacter.getState();
    expect(s.character.spellbook.map((x) => x.name)).toEqual(["Shield", "Fireball"]);
    expect(s.character.spellbook[1].source).toBe("custom");
    expect(s.customSpells["lyari"].spellbook).toHaveLength(1);
  });

  it("puts a level 0 spell in the cantrips", () => {
    useCharacter.getState().addCustomSpell({ name: "Spark", level: 0, school: "Evocation" });
    const s = useCharacter.getState();
    expect(s.character.cantrips.map((x) => x.name)).toEqual(["Fire Bolt", "Spark"]);
    expect(s.customSpells["lyari"].cantrips).toHaveLength(1);
  });

  it("refuses a duplicate name across casing, cantrips and innate spells", () => {
    expect(useCharacter.getState().addCustomSpell({
      name: "shield", level: 1, school: "Abjuration",
    })).toEqual({ ok: false, error: expect.stringContaining("already") });

    expect(useCharacter.getState().addCustomSpell({
      name: "Fire Bolt", level: 0, school: "Evocation",
    }).ok).toBe(false);

    expect(useCharacter.getState().addCustomSpell({
      name: "Misty Step", level: 2, school: "Conjuration",
    }).ok).toBe(false);

    expect(useCharacter.getState().customSpells["lyari"]).toBeUndefined();
  });

  it("refuses a blank name", () => {
    expect(useCharacter.getState().addCustomSpell({
      name: "   ", level: 1, school: "Evocation",
    }).ok).toBe(false);
  });

  it("does not auto-prepare", () => {
    useCharacter.getState().addCustomSpell({ name: "Fireball", level: 3, school: "Evocation" });
    expect(useCharacter.getState().character.preparedSpells).toEqual([]);
  });
});

describe("updateCustomSpell / removeCustomSpell", () => {
  beforeEach(() => {
    useCharacter.setState({
      character: makeChar({
        spellbook: [{ name: "Shield", level: 1, school: "Abjuration", source: "class" }],
        cantrips: [],
        innateSpells: [],
        preparedSpells: [],
        concentration: null,
      }),
      activeCharacterId: "lyari",
      customSpells: {},
    });
    useCharacter.getState().addCustomSpell({ name: "Fireball", level: 3, school: "Evocation" });
    useCharacter.getState().togglePrepared("Fireball");
    useCharacter.getState().setConcentration("Fireball", 3);
  });

  it("renames, carrying preparation and concentration with it", () => {
    const res = useCharacter.getState().updateCustomSpell("Fireball", {
      name: "Fire Ball", level: 3, school: "Evocation",
    });
    expect(res.ok).toBe(true);
    const s = useCharacter.getState();
    expect(s.character.spellbook.map((x) => x.name)).toEqual(["Shield", "Fire Ball"]);
    expect(s.character.preparedSpells).toEqual(["Fire Ball"]);
    expect(s.character.concentration?.spellName).toBe("Fire Ball");
    expect(s.customSpells["lyari"].spellbook[0].name).toBe("Fire Ball");
  });

  it("refuses a rename onto an existing name but allows keeping its own", () => {
    expect(useCharacter.getState().updateCustomSpell("Fireball", {
      name: "Shield", level: 3, school: "Evocation",
    }).ok).toBe(false);

    expect(useCharacter.getState().updateCustomSpell("Fireball", {
      name: "Fireball", level: 4, school: "Evocation",
    }).ok).toBe(true);
    expect(useCharacter.getState().character.spellbook[1].level).toBe(4);
  });

  it("refuses to move a spell across the cantrip boundary", () => {
    expect(useCharacter.getState().updateCustomSpell("Fireball", {
      name: "Fireball", level: 0, school: "Evocation",
    })).toEqual({ ok: false, error: expect.stringContaining("cantrip") });
  });

  it("refuses to touch a library spell", () => {
    expect(useCharacter.getState().updateCustomSpell("Shield", {
      name: "Shielded", level: 1, school: "Abjuration",
    }).ok).toBe(false);
    useCharacter.getState().removeCustomSpell("Shield");
    expect(useCharacter.getState().character.spellbook.map((x) => x.name)).toContain("Shield");
  });

  it("deletes, pruning preparation and dropping concentration", () => {
    useCharacter.getState().removeCustomSpell("Fireball");
    const s = useCharacter.getState();
    expect(s.character.spellbook.map((x) => x.name)).toEqual(["Shield"]);
    expect(s.character.preparedSpells).toEqual([]);
    expect(s.character.concentration).toBeNull();
    expect(s.customSpells["lyari"].spellbook).toHaveLength(0);
  });

  it("leaves concentration alone when it names a different spell", () => {
    useCharacter.getState().setConcentration("Shield", 1);
    useCharacter.getState().removeCustomSpell("Fireball");
    expect(useCharacter.getState().character.concentration?.spellName).toBe("Shield");
  });
});

describe("loadCharacter and the custom-spell stash", () => {
  const lyari = () => makeChar({
    name: "Lyari",
    spellbook: [{ name: "Shield", level: 1, school: "Abjuration", source: "class" }],
    cantrips: [], innateSpells: [], preparedSpells: [],
  });
  const brunella = () => makeChar({
    name: "Brunella",
    spellbook: [{ name: "Vicious Mockery", level: 1, school: "Enchantment", source: "class" }],
    cantrips: [], innateSpells: [], preparedSpells: [],
  });

  beforeEach(() => {
    useCharacter.setState({ character: lyari(), activeCharacterId: "lyari", customSpells: {} });
    useCharacter.getState().addCustomSpell({ name: "Fireball", level: 3, school: "Evocation" });
  });

  it("re-applies the customs when the same character reloads from the library", () => {
    useCharacter.getState().loadCharacter(lyari(), { sourceId: "lyari", revision: "abc" });
    expect(useCharacter.getState().character.spellbook.map((s) => s.name))
      .toEqual(["Shield", "Fireball"]);
  });

  it("does not hand them to a different character, and restores them on the way back", () => {
    useCharacter.getState().loadCharacter(brunella(), { sourceId: "brunella" });
    expect(useCharacter.getState().character.spellbook.map((s) => s.name))
      .toEqual(["Vicious Mockery"]);

    useCharacter.getState().loadCharacter(lyari(), { sourceId: "lyari" });
    expect(useCharacter.getState().character.spellbook.map((s) => s.name))
      .toEqual(["Shield", "Fireball"]);
  });

  it("drops a custom the library now provides itself (promotion)", () => {
    const promoted = makeChar({
      name: "Lyari",
      spellbook: [
        { name: "Shield", level: 1, school: "Abjuration", source: "class" },
        { name: "Fireball", level: 3, school: "Evocation", source: "class" },
      ],
      cantrips: [], innateSpells: [], preparedSpells: [],
    });
    useCharacter.getState().loadCharacter(promoted, { sourceId: "lyari" });
    const s = useCharacter.getState();
    expect(s.character.spellbook.filter((x) => x.name === "Fireball")).toHaveLength(1);
    expect(s.character.spellbook.find((x) => x.name === "Fireball")?.source).toBe("class");
    expect(s.customSpells["lyari"].spellbook).toHaveLength(0);
  });

  it("clears the shared custom bucket on an import", () => {
    // Every Settings import lands in the same "custom" id, so spells typed for
    // one imported sheet must not follow her onto the next.
    useCharacter.getState().loadCharacter(brunella());
    expect(useCharacter.getState().activeCharacterId).toBe("custom");
    expect(useCharacter.getState().character.spellbook.map((s) => s.name))
      .toEqual(["Vicious Mockery"]);
    useCharacter.getState().addCustomSpell({ name: "Bless", level: 1, school: "Enchantment" });
    useCharacter.getState().loadCharacter(lyari());
    expect(useCharacter.getState().character.spellbook.map((s) => s.name)).toEqual(["Shield"]);
    expect(useCharacter.getState().customSpells["custom"]).toEqual({ spellbook: [], cantrips: [] });
  });
});

describe("applyRemoteSheet", () => {
  beforeEach(() => {
    useCharacter.setState({
      character: makeChar({
        spellbook: [{ name: "Shield", level: 1, school: "Abjuration", source: "class" }],
        cantrips: [], innateSpells: [], preparedSpells: [],
      }),
      activeCharacterId: "lyari",
      customSpells: {},
    });
    useCharacter.getState().addCustomSpell({ name: "Fireball", level: 3, school: "Evocation" });
  });

  it("takes the remote customs when the remote has them", () => {
    const sheet = extractDurable(useCharacter.getState().character);
    useCharacter.getState().applyRemoteSheet("lyari", {
      ...sheet,
      customSpells: {
        spellbook: [{ name: "Counterspell", level: 3, school: "Abjuration", source: "custom" }],
        cantrips: [],
      },
    });
    const s = useCharacter.getState();
    expect(s.character.spellbook.map((x) => x.name)).toEqual(["Shield", "Counterspell"]);
    expect(s.customSpells["lyari"].spellbook.map((x) => x.name)).toEqual(["Counterspell"]);
  });

  it("keeps the local ones when the remote sheet predates the field", () => {
    const sheet = extractDurable(useCharacter.getState().character);
    // What a device on an older build pushes: no customSpells key at all.
    const stale = { ...sheet } as Record<string, unknown>;
    delete stale.customSpells;
    useCharacter.getState().applyRemoteSheet("lyari", stale as never);
    expect(useCharacter.getState().character.spellbook.map((x) => x.name))
      .toEqual(["Shield", "Fireball"]);
  });

  it("applies an empty remote list as a deletion", () => {
    const sheet = extractDurable(useCharacter.getState().character);
    useCharacter.getState().applyRemoteSheet("lyari", {
      ...sheet,
      customSpells: { spellbook: [], cantrips: [] },
    });
    expect(useCharacter.getState().character.spellbook.map((x) => x.name)).toEqual(["Shield"]);
  });
});

/**
 * The Rituals tab used to show a non-Wizard only their PREPARED rituals, with
 * no hint the others existed. Adding a ritual made that immediately visible:
 * the spell saved fine, appeared under Spellbook, and was simply absent from
 * the page named for rituals.
 */
describe("ritualsNeedingPreparation", () => {
  const ritual: Spell = { name: "Detect Magic", level: 1, school: "Divination", ritual: true };
  const other: Spell = { name: "Illusory Script", level: 1, school: "Illusion", ritual: true };

  it("lists a Bard's unprepared spellbook rituals", () => {
    const names = ritualsNeedingPreparation(
      makeChar({ className: "Bard", spellbook: [ritual, other], preparedSpells: ["Detect Magic"] }),
    ).map((s) => s.name);
    expect(names).toEqual(["Illusory Script"]);
  });

  it("is empty for a Wizard, whose unprepared rituals are already castable", () => {
    expect(
      ritualsNeedingPreparation(
        makeChar({ spellbook: [ritual, other], preparedSpells: [] }),
      ),
    ).toEqual([]);
  });

  it("never lists innate rituals, which need no preparation", () => {
    const names = ritualsNeedingPreparation(
      makeChar({
        className: "Bard",
        spellbook: [],
        preparedSpells: [],
        innateSpells: [{ name: "Guiding Hand", level: 1, school: "Divination", ritual: true }],
      }),
    ).map((s) => s.name);
    expect(names).toEqual([]);
  });

  it("catches a freshly added custom ritual, which is never auto-prepared", () => {
    useCharacter.setState({
      character: makeChar({ className: "Bard", spellbook: [], preparedSpells: [], cantrips: [] }),
      activeCharacterId: "brunella",
      customSpells: {},
    });
    useCharacter.getState().addCustomSpell({
      name: "Bard Probe Ritual", level: 1, school: "Evocation", ritual: true,
    });
    const c = useCharacter.getState().character;
    expect(availableRituals(c).map((s) => s.name)).toEqual([]);
    expect(ritualsNeedingPreparation(c).map((s) => s.name)).toEqual(["Bard Probe Ritual"]);
  });
});

/**
 * `preparedNonRituals` filters only by preparation — it does NOT exclude
 * rituals, despite the name. Encounter used to union it with preparedRituals,
 * which rendered every prepared ritual twice with a duplicate React key. This
 * pins the behaviour the view now relies on.
 */
describe("preparedNonRituals really includes rituals", () => {
  const ritual: Spell = { name: "Detect Magic", level: 1, school: "Divination", ritual: true };
  const plain: Spell = { name: "Magic Missile", level: 1, school: "Evocation" };

  it("already contains a prepared ritual, so unioning preparedRituals duplicates it", () => {
    const c = makeChar({
      spellbook: [ritual, plain],
      preparedSpells: ["Detect Magic", "Magic Missile"],
    });
    expect(preparedNonRituals(c).map((s) => s.name)).toContain("Detect Magic");

    // The shape the view used to build. Kept as the regression guard: if
    // someone reinstates the union, this count goes back to 2.
    const unioned = [...preparedNonRituals(c), ...preparedRituals(c)].filter(
      (s) => s.name === "Detect Magic",
    );
    expect(unioned).toHaveLength(2);
  });
});
