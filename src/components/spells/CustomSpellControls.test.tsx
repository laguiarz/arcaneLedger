// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SpellCard from "@/components/SpellCard";
import { useCharacter } from "@/store/character";
import { sampleWizard } from "@/data/sampleWizard";
import type { Spell } from "@/types/character";

const mine: Spell = { name: "Fireball", level: 3, school: "Evocation", source: "custom" };
const theirs: Spell = { name: "Shield", level: 1, school: "Abjuration", source: "class" };

beforeEach(() => {
  useCharacter.setState({
    character: {
      ...sampleWizard,
      spellbook: [theirs, mine],
      cantrips: [],
      innateSpells: [],
      preparedSpells: [],
    },
    activeCharacterId: "lyari",
    customSpells: { lyari: { spellbook: [mine], cantrips: [] } },
  });
});

// Vitest runs without `globals`, so RTL's auto-cleanup never registers.
afterEach(cleanup);

describe("custom spell controls", () => {
  it("shows the Custom chip and the controls only on her own spell", () => {
    const { unmount } = render(<SpellCard spell={mine} onEdit={() => {}} />);
    expect(screen.getByText("Custom")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit spell" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete spell" })).toBeTruthy();
    unmount();

    render(<SpellCard spell={theirs} onEdit={() => {}} />);
    expect(screen.queryByText("Custom")).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit spell" })).toBeNull();
  });

  it("deletes only on the second click", async () => {
    const user = userEvent.setup();
    render(<SpellCard spell={mine} onEdit={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Delete spell" }));
    expect(useCharacter.getState().character.spellbook.map((s) => s.name)).toEqual([
      "Shield",
      "Fireball",
    ]);
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(useCharacter.getState().character.spellbook.map((s) => s.name)).toEqual(["Shield"]);
  });

  it("calls onEdit with the spell", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<SpellCard spell={mine} onEdit={onEdit} />);
    await user.click(screen.getByRole("button", { name: "Edit spell" }));
    expect(onEdit).toHaveBeenCalledWith(mine);
  });
});
