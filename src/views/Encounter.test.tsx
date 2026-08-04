// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Encounter from "@/views/Encounter";
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
  return render(<Encounter />);
}

// Vitest runs without `globals`, so RTL's auto-cleanup never registers.
afterEach(cleanup);

describe("Encounter spell section heading", () => {
  it('says just "Spells" for a Bard, who has nothing unprepared to contrast with', () => {
    mount(load(brunella));
    expect(screen.getByText("Spells")).toBeTruthy();
    expect(screen.queryByText("Prepared Spells")).toBeNull();
  });

  it('keeps "Prepared Spells" for a Wizard, whose spellbook holds more', () => {
    mount(load(lyari));
    expect(screen.getByText("Prepared Spells")).toBeTruthy();
  });
});
