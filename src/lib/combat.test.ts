import { describe, it, expect } from "vitest";
import type { Combatant } from "@/types/combat";
import {
  moveItem,
  rollInitiative,
  sortByInitiative,
  tickConditions,
} from "@/lib/combat";

function c(
  name: string,
  initiative: number | null,
  initiativeBonus = 0,
): Combatant {
  return {
    id: name,
    name,
    kind: "monster",
    initiative,
    initiativeBonus,
    conditions: [],
    actions: {},
  };
}

describe("sortByInitiative", () => {
  it("orders by initiative descending", () => {
    const order = sortByInitiative([c("a", 12), c("b", 20), c("c", 5)]).map(
      (x) => x.name,
    );
    expect(order).toEqual(["b", "a", "c"]);
  });

  it("sinks combatants without an initiative to the bottom", () => {
    const order = sortByInitiative([c("a", null), c("b", 8), c("c", null)]).map(
      (x) => x.name,
    );
    expect(order[0]).toBe("b");
    expect(order.slice(1).sort()).toEqual(["a", "c"]);
  });

  it("breaks ties by initiative bonus then name", () => {
    const order = sortByInitiative([
      c("zed", 15, 1),
      c("ana", 15, 1),
      c("max", 15, 4),
    ]).map((x) => x.name);
    expect(order).toEqual(["max", "ana", "zed"]);
  });

  it("does not mutate the input array", () => {
    const input = [c("a", 1), c("b", 2)];
    sortByInitiative(input);
    expect(input.map((x) => x.name)).toEqual(["a", "b"]);
  });
});

describe("tickConditions", () => {
  it("decrements timed conditions and drops expired ones", () => {
    const result = tickConditions([
      { id: "prone", rounds: 2 },
      { id: "stunned", rounds: 1 },
    ]);
    expect(result).toEqual([{ id: "prone", rounds: 1 }]);
  });

  it("keeps indefinite conditions untouched", () => {
    const result = tickConditions([{ id: "blinded" }]);
    expect(result).toEqual([{ id: "blinded" }]);
  });
});

describe("moveItem", () => {
  it("moves an item up", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
  });
  it("moves an item down", () => {
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
  });
  it("is a no-op at the boundaries", () => {
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
});

describe("rollInitiative", () => {
  it("returns d20 + bonus using the injected rng", () => {
    expect(rollInitiative(3, () => 0)).toBe(4); // floor(0*20)+1 + 3
    expect(rollInitiative(3, () => 0.999)).toBe(23); // floor(19.98)+1 + 3
  });
});
