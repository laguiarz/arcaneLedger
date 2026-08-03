import { describe, it, expect, beforeEach } from "vitest";
import { useCharacter } from "./character";
import type { Resource } from "@/types/character";

/**
 * The bow's charges: a dawn resource that recovers on a die roll, so a long
 * rest must NOT hand it back for free.
 */
const diceItem: Resource = {
  name: "Bow — Charges",
  max: 6,
  used: 4,
  recharge: "dawn",
  rechargeDice: "1d6",
};

/** The sample wizard's wand: a plain dawn resource, behaviour unchanged. */
const plainDawn: Resource = {
  name: "Wand",
  max: 7,
  used: 3,
  recharge: "dawn",
};

function seed(resources: Resource[]) {
  useCharacter.setState((s) => ({
    character: { ...s.character, resources },
  }));
}

function used(name: string): number | undefined {
  return useCharacter.getState().character.resources.find((r) => r.name === name)?.used;
}

describe("refundResource", () => {
  beforeEach(() => seed([{ ...diceItem }]));

  it("gives back the rolled amount", () => {
    useCharacter.getState().refundResource("Bow — Charges", 3);
    expect(used("Bow — Charges")).toBe(1);
  });

  it("clamps at zero used when the roll overshoots what was spent", () => {
    useCharacter.getState().refundResource("Bow — Charges", 99);
    expect(used("Bow — Charges")).toBe(0);
  });
});

describe("longRest and dice-recharge resources", () => {
  beforeEach(() => seed([{ ...diceItem }, { ...plainDawn }]));

  it("leaves a dice-recharge dawn resource alone", () => {
    useCharacter.getState().longRest();
    expect(used("Bow — Charges")).toBe(4);
  });

  it("still refills a plain dawn resource", () => {
    useCharacter.getState().longRest();
    expect(used("Wand")).toBe(0);
  });

  it("still refills a long-rest resource even if it carries dice", () => {
    // recharge: "long" means what it says; the dice are only how much you get
    // back at dawn, and a long rest is not a dawn.
    seed([{ name: "Odd", max: 3, used: 2, recharge: "long", rechargeDice: "1d4" }]);
    useCharacter.getState().longRest();
    expect(used("Odd")).toBe(0);
  });
});
