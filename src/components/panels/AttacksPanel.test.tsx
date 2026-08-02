// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useCharacter } from "@/store/character";
import type { Weapon } from "@/types/character";
import AttacksPanel from "./AttacksPanel";

// RTL's auto-cleanup does not run: vitest globals are off in this project.
afterEach(cleanup);

const bow: Weapon = {
  name: "Longbow +2",
  ability: "dex",
  proficient: false,
  magicBonus: 2,
  damageDice: "1d8",
  damageType: "Piercing",
  range: "150/600 ft",
  properties: ["Ammunition", "Heavy", "Two-Handed"],
};

function setWeapons(weapons: Weapon[] | undefined) {
  useCharacter.setState((s) => ({
    character: {
      ...s.character,
      proficiencyBonus: 3,
      abilities: {
        ...s.character.abilities,
        dex: { base: 15, featBonus: 2, magicBonus: 0 },
      },
      weapons,
    },
  }));
}

describe("AttacksPanel", () => {
  it("renders the attack bonus and the damage", () => {
    setWeapons([bow]);
    render(<AttacksPanel />);
    expect(screen.getByText("Longbow +2")).toBeTruthy();
    expect(screen.getByText("+5")).toBeTruthy();
    expect(screen.getByText("1d8+5 Piercing")).toBeTruthy();
  });

  it("says out loud that proficiency does not apply", () => {
    setWeapons([bow]);
    render(<AttacksPanel />);
    expect(screen.getByText(/not proficient/)).toBeTruthy();
  });

  it("adds the proficiency bonus when the weapon is proficient", () => {
    setWeapons([{ ...bow, proficient: true }]);
    render(<AttacksPanel />);
    expect(screen.getByText("+8")).toBeTruthy();
  });

  it("renders nothing when the weapon list is empty", () => {
    setWeapons([]);
    const { container } = render(<AttacksPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when weapons is undefined", () => {
    setWeapons(undefined);
    const { container } = render(<AttacksPanel />);
    expect(container.innerHTML).toBe("");
  });
});
