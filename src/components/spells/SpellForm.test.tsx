// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SpellForm from "./SpellForm";
import { useCharacter } from "@/store/character";
import { sampleWizard } from "@/data/sampleWizard";

beforeEach(() => {
  useCharacter.setState({
    character: {
      ...sampleWizard,
      spellbook: [{ name: "Shield", level: 1, school: "Abjuration", source: "class" }],
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

describe("SpellForm", () => {
  it("adds a leveled spell to the store", async () => {
    const user = userEvent.setup();
    render(<SpellForm editing={null} onClose={() => {}} />);
    await user.type(screen.getByLabelText("Name"), "Fireball");
    await user.selectOptions(screen.getByLabelText("Level"), "3");
    await user.selectOptions(screen.getByLabelText("School"), "Evocation");
    await user.click(screen.getByRole("button", { name: "Save spell" }));
    expect(useCharacter.getState().character.spellbook.map((s) => s.name)).toEqual([
      "Shield",
      "Fireball",
    ]);
  });

  it("blocks a duplicate name with an inline message", async () => {
    const user = userEvent.setup();
    render(<SpellForm editing={null} onClose={() => {}} />);
    await user.type(screen.getByLabelText("Name"), "shield");
    await user.click(screen.getByRole("button", { name: "Save spell" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/already on this sheet/i);
    expect(useCharacter.getState().character.spellbook).toHaveLength(1);
  });

  it("requires a name", async () => {
    const user = userEvent.setup();
    render(<SpellForm editing={null} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Save spell" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/name is required/i);
  });

  it("hides ritual and concentration for a cantrip", async () => {
    // `Cantrip` has neither field, so offering them would lie.
    const user = userEvent.setup();
    render(<SpellForm editing={null} onClose={() => {}} />);
    expect(screen.getByLabelText("Ritual")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Level"), "0");
    expect(screen.queryByLabelText("Ritual")).toBeNull();
    expect(screen.queryByLabelText("Concentration")).toBeNull();
  });

  it("saves a cantrip into the cantrip list", async () => {
    const user = userEvent.setup();
    render(<SpellForm editing={null} onClose={() => {}} />);
    await user.type(screen.getByLabelText("Name"), "Spark");
    await user.selectOptions(screen.getByLabelText("Level"), "0");
    await user.click(screen.getByRole("button", { name: "Save spell" }));
    expect(useCharacter.getState().character.cantrips.map((s) => s.name)).toEqual(["Spark"]);
  });

  it("edits an existing custom spell in place", async () => {
    useCharacter.getState().addCustomSpell({ name: "Fireball", level: 3, school: "Evocation" });
    const mine = useCharacter.getState().character.spellbook[1];
    const user = userEvent.setup();
    render(<SpellForm editing={mine} onClose={() => {}} />);
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Fire Ball");
    await user.click(screen.getByRole("button", { name: "Save spell" }));
    expect(useCharacter.getState().character.spellbook.map((s) => s.name)).toEqual([
      "Shield",
      "Fire Ball",
    ]);
  });
});
