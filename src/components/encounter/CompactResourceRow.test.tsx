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

function castButton() {
  return screen.getByRole("button", { name: /cast ensnaring strike/i });
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

  it("warns that casting replaces an existing concentration", () => {
    seed(bowCharges, { spellName: "Faerie Fire", level: 1, rounds: 2 });
    render(<CompactResourceRow resource={bowCharges} />);
    expect(screen.getByText(/replaces faerie fire/i)).toBeTruthy();
  });

  it("does not warn when already concentrating on this same spell", () => {
    seed(bowCharges, { spellName: "Ensnaring Strike", level: 1, rounds: 1 });
    render(<CompactResourceRow resource={bowCharges} />);
    expect(screen.queryByText(/replaces/i)).toBeNull();
  });

  it("shows the item DC alongside the character's own", () => {
    render(<CompactResourceRow resource={bowCharges} />);
    // Bard DC = 8 + 3 proficiency + 4 (Cha 19) = 15.
    expect(screen.getByText(/DC 13 \(item\)/)).toBeTruthy();
    expect(screen.getByText(/DC 15 \(yours\)/)).toBeTruthy();
  });

  it("degrades to a plain counter when the spell reference dangles", () => {
    const dangling = { ...bowCharges, itemSpell: { name: "No Such Spell", saveDc: 13 } };
    seed(dangling);
    render(<CompactResourceRow resource={dangling} />);
    expect(screen.queryByRole("button", { name: /^cast /i })).toBeNull();
  });
});
