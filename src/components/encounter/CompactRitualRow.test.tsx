// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompactRitualRow from "./CompactRitualRow";
import { useCharacter } from "@/store/character";
import { sampleWizard } from "@/data/sampleWizard";
import type { Spell } from "@/types/character";

const ritual: Spell = { name: "Illusory Script", level: 1, school: "Illusion", ritual: true };
const mine: Spell = {
  name: "Whispered Rite", level: 2, school: "Evocation", ritual: true, source: "custom",
};

beforeEach(() => {
  useCharacter.setState({
    character: {
      ...sampleWizard,
      spellbook: [ritual, mine],
      cantrips: [],
      innateSpells: [],
      preparedSpells: [],
    },
    activeCharacterId: "lyari",
    customSpells: {},
  });
});

// Vitest runs without `globals`, so RTL's auto-cleanup never registers.
afterEach(cleanup);

describe("CompactRitualRow", () => {
  it("shows the name, level and Ritual chip", () => {
    render(<CompactRitualRow spell={ritual} />);
    expect(screen.getByText("Illusory Script")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByTitle("Ritual — casting time + 10 min, no spell slot")).toBeTruthy();
  });

  it("renders no cast button — ritualising changes nothing the app tracks", () => {
    render(<CompactRitualRow spell={ritual} />);
    expect(screen.queryByRole("button", { name: /cast/i })).toBeNull();
  });

  it("shows the Custom chip only for a spell she wrote", () => {
    const { unmount } = render(<CompactRitualRow spell={mine} />);
    expect(screen.getByText("Custom")).toBeTruthy();
    unmount();
    render(<CompactRitualRow spell={ritual} />);
    expect(screen.queryByText("Custom")).toBeNull();
  });

  it("has no star unless asked for one", () => {
    render(<CompactRitualRow spell={ritual} />);
    expect(screen.queryByRole("button", { name: "Prepare" })).toBeNull();
  });

  it("prepares the spell when the star is tapped", async () => {
    const user = userEvent.setup();
    render(<CompactRitualRow spell={ritual} showPrepareToggle />);
    await user.click(screen.getByRole("button", { name: "Prepare" }));
    // Assert the behaviour, not the prop.
    expect(useCharacter.getState().character.preparedSpells).toContain("Illusory Script");
  });
});
