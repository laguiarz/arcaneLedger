// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Spellbook from "@/views/Spellbook";
import { useCharacter } from "@/store/character";
import { normalizeAbilities } from "@/lib/abilities";
import brunella from "../../public/characters/brunella.json";
import lyari from "../../public/characters/lyari.json";
import type { Character } from "@/types/character";

function load(raw: unknown): Character {
  const c = raw as Character;
  return { ...c, abilities: normalizeAbilities((raw as { abilities: unknown }).abilities) };
}

function mount(c: Character) {
  useCharacter.setState({ character: c });
  return render(<Spellbook />);
}

// Vitest runs without `globals`, so RTL's auto-cleanup never registers.
afterEach(cleanup);

beforeEach(() => {
  useCharacter.setState({ character: load(brunella) });
});

/**
 * A 2024 Bard has no pool to prepare FROM: every spell she knows is prepared,
 * so a Prepared tab would list exactly what the Spellbook tab lists. The Wizard
 * is the only class whose spellbook is bigger than the prepared list, so she is
 * the only one for whom the distinction means anything.
 */
describe("Spellbook tabs", () => {
  it("hides the Prepared tab for a Bard", () => {
    mount(load(brunella));
    expect(screen.queryByRole("button", { name: /Prepared/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Spellbook/ })).toBeTruthy();
  });

  it("keeps the Prepared tab for a Wizard", () => {
    mount(load(lyari));
    expect(screen.getByRole("button", { name: /Prepared/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Spellbook/ })).toBeTruthy();
  });

  it("opens on the Spellbook tab for a Bard instead of a missing tab", () => {
    mount(load(brunella));
    // The Spellbook tab's own heading, rendered only when that tab is active.
    expect(screen.getByText(/Full Spellbook/i)).toBeTruthy();
  });

  it("still opens on Prepared for a Wizard", () => {
    mount(load(lyari));
    expect(screen.getByText(/Prepared Incantations/i)).toBeTruthy();
  });
});
