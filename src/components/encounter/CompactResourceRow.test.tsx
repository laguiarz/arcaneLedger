// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useCharacter } from "@/store/character";
import type { ConcentrationState, Resource, Spell } from "@/types/character";
import CompactResourceRow from "./CompactResourceRow";

// RTL's auto-cleanup does not run: vitest globals are off in this project.
afterEach(cleanup);

const ensnaring: Spell = {
  name: "Ensnaring Strike",
  level: 1,
  school: "Conjuration",
  castingTime: "Bonus Action, immediately after hitting a creature with a weapon",
  range: "Self",
  components: "V",
  duration: "Concentration, up to 1 minute",
  desc: "As you hit the target, grasping vines appear on it…",
  concentration: true,
  source: "item",
};

const bowCharges: Resource = {
  name: "Longbow +2 — Charges",
  source: "Magic item",
  max: 6,
  used: 0,
  recharge: "dawn",
  rechargeDice: "1d6",
  actionType: "bonus",
  itemSpell: { name: "Ensnaring Strike", saveDc: 13 },
};

function seed(resource: Resource, concentration: ConcentrationState | null = null) {
  useCharacter.setState((s) => ({
    character: {
      ...s.character,
      proficiencyBonus: 3,
      spellcastingAbility: "cha",
      spellSaveDcOverride: undefined,
      abilities: {
        ...s.character.abilities,
        cha: { base: 17, featBonus: 2, magicBonus: 0 },
      },
      innateSpells: [ensnaring],
      resources: [resource],
      concentration,
    },
  }));
}

/**
 * The bolt IS the cast button for an item that carries a spell — there is no
 * separate one, because the bolt is how everything else in the app is spent.
 */
function castButton() {
  return screen.getByRole("button", { name: /cast ensnaring strike/i });
}

/** The details panel starts collapsed, like every other resource row. */
function openDetails() {
  fireEvent.click(screen.getByRole("button", { name: /toggle details/i }));
}

beforeEach(() => seed(bowCharges));

describe("CompactResourceRow with an item spell", () => {
  it("spends exactly one charge when cast", () => {
    render(<CompactResourceRow resource={bowCharges} />);
    fireEvent.click(castButton());
    expect(useCharacter.getState().character.resources[0].used).toBe(1);
  });

  it("takes up concentration on cast", () => {
    render(<CompactResourceRow resource={bowCharges} />);
    fireEvent.click(castButton());
    expect(useCharacter.getState().character.concentration?.spellName).toBe(
      "Ensnaring Strike",
    );
  });

  it("never touches a spell slot", () => {
    const before = { ...useCharacter.getState().character.spellSlots };
    render(<CompactResourceRow resource={bowCharges} />);
    fireEvent.click(castButton());
    expect(useCharacter.getState().character.spellSlots).toEqual(before);
  });

  it("disables Cast at zero charges", () => {
    const empty = { ...bowCharges, used: 6 };
    seed(empty);
    render(<CompactResourceRow resource={empty} />);
    expect((castButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers exactly one way to cast, not a second button", () => {
    render(<CompactResourceRow resource={bowCharges} />);
    expect(screen.getAllByRole("button", { name: /cast ensnaring strike/i })).toHaveLength(1);
  });

  it("warns in the row itself that casting replaces an existing concentration", () => {
    // Collapsed: the warning has to be visible without opening anything,
    // because the tooltip is useless on a tablet.
    seed(bowCharges, { spellName: "Faerie Fire", level: 1, rounds: 2 });
    render(<CompactResourceRow resource={bowCharges} />);
    expect(screen.getByText(/drops faerie fire/i)).toBeTruthy();
  });

  it("does not warn when already concentrating on this same spell", () => {
    seed(bowCharges, { spellName: "Ensnaring Strike", level: 1, rounds: 1 });
    render(<CompactResourceRow resource={bowCharges} />);
    expect(screen.queryByText(/drops /i)).toBeNull();
  });

  it("shows the item DC alongside the character's own", () => {
    render(<CompactResourceRow resource={bowCharges} />);
    openDetails();
    // Bard DC = 8 + 3 proficiency + 4 (Cha 19) = 15.
    expect(screen.getByText(/DC 13 \(item\)/)).toBeTruthy();
    expect(screen.getByText(/DC 15 \(yours\)/)).toBeTruthy();
  });

  it("degrades to a plain counter when the spell reference dangles", () => {
    const dangling = { ...bowCharges, itemSpell: { name: "No Such Spell", saveDc: 13 } };
    seed(dangling);
    render(<CompactResourceRow resource={dangling} />);
    // The bolt is back to being a plain "Use", and spending takes no concentration.
    expect(screen.queryByRole("button", { name: /^cast /i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^use$/i }));
    expect(useCharacter.getState().character.resources[0].used).toBe(1);
    expect(useCharacter.getState().character.concentration).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Chargeless item spells — the Ritual-Grimoire shape: max 0, unlimited use.
// ---------------------------------------------------------------------------

const guidingHand: Spell = {
  name: "Guiding Hand",
  level: 1,
  school: "Divination",
  castingTime: "1 minute",
  duration: "Concentration, up to 8 hours",
  desc: "You manifest a tiny luminous hand…",
  ritual: true,
  concentration: true,
  source: "item",
};

const wildCunning: Spell = {
  name: "Wild Cunning",
  level: 1,
  school: "Transmutation",
  castingTime: "Action",
  duration: "Instantaneous",
  desc: "You invoke nature spirits for aid…",
  ritual: true,
  source: "item",
};

const chargeless = (name: string): Resource => ({
  name,
  source: "Ritual-Grimoire",
  max: 0,
  used: 0,
  recharge: "manual",
  itemSpell: { name },
});

function seedSpells(
  spells: Spell[],
  resource: Resource,
  concentration: ConcentrationState | null = null,
) {
  useCharacter.setState((s) => ({
    character: {
      ...s.character,
      innateSpells: spells,
      resources: [resource],
      concentration,
    },
  }));
}

describe("a chargeless item spell", () => {
  it("gives a concentration ritual an ENABLED bolt", () => {
    // remaining is 0 - 0 = 0 here; anything still keyed on it renders "Depleted".
    const r = chargeless("Guiding Hand");
    seedSpells([guidingHand], r);
    render(<CompactResourceRow resource={r} />);
    const b = screen.getByRole("button", {
      name: /cast guiding hand/i,
    }) as HTMLButtonElement;
    expect(b.disabled).toBe(false);
  });

  it("does not promise a charge it never spends", () => {
    const r = chargeless("Guiding Hand");
    seedSpells([guidingHand], r);
    render(<CompactResourceRow resource={r} />);
    expect(screen.queryByRole("button", { name: /spends 1 charge/i })).toBeNull();
  });

  it("takes concentration when cast, and spends nothing", () => {
    const r = chargeless("Guiding Hand");
    seedSpells([guidingHand], r);
    render(<CompactResourceRow resource={r} />);
    fireEvent.click(screen.getByRole("button", { name: /cast guiding hand/i }));
    const st = useCharacter.getState().character;
    expect(st.concentration?.spellName).toBe("Guiding Hand");
    expect(st.resources[0].used).toBe(0);
  });

  it("warns about replacing concentration with the row COLLAPSED", () => {
    // Regression guard for PR #22: the warning used to live inside the counter
    // branch, which a chargeless row never enters.
    const r = chargeless("Guiding Hand");
    seedSpells([guidingHand], r, { spellName: "Faerie Fire", level: 1, rounds: 2 });
    render(<CompactResourceRow resource={r} />);
    expect(screen.getByText(/drops faerie fire/i)).toBeTruthy();
  });

  it("gives a non-concentration ritual no bolt at all", () => {
    const r = chargeless("Wild Cunning");
    seedSpells([wildCunning], r);
    render(<CompactResourceRow resource={r} />);
    expect(screen.queryByRole("button", { name: /^cast /i })).toBeNull();
  });

  it("is not labelled passive", () => {
    const r = chargeless("Wild Cunning");
    seedSpells([wildCunning], r);
    render(<CompactResourceRow resource={r} />);
    expect(screen.queryByText(/passive/i)).toBeNull();
  });

  it("IS labelled passive when the reference dangles, rather than rendering empty", () => {
    const r = chargeless("Nothing Here");
    seedSpells([], r);
    render(<CompactResourceRow resource={r} />);
    expect(screen.getByText(/passive/i)).toBeTruthy();
  });

  it("shows a Ritual chip", () => {
    const r = chargeless("Wild Cunning");
    seedSpells([wildCunning], r);
    render(<CompactResourceRow resource={r} />);
    expect(screen.getByText(/^ritual$/i)).toBeTruthy();
  });

  it("shows no DC line for a spell with no saving throw", () => {
    const r = chargeless("Guiding Hand");
    seedSpells([guidingHand], r);
    render(<CompactResourceRow resource={r} />);
    fireEvent.click(screen.getByRole("button", { name: /toggle details/i }));
    expect(screen.queryByText(/DC \d+ \(yours\)/)).toBeNull();
  });
});
