import { describe, it, expect } from "vitest";
import type { Combatant } from "@/types/combat";
import {
  activeConditionsInRound,
  conditionActiveInRound,
  isInactive,
  moveItem,
  rollInitiative,
  sortByInitiative,
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

  it("sinks inactive combatants (initiative 0) to the bottom", () => {
    const order = sortByInitiative([c("a", 0), c("b", 12), c("c", 3)]).map(
      (x) => x.name,
    );
    expect(order).toEqual(["b", "c", "a"]);
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

describe("isInactive", () => {
  it("is true only for initiative 0", () => {
    expect(isInactive(c("a", 0))).toBe(true);
    expect(isInactive(c("b", 5))).toBe(false);
    expect(isInactive(c("c", null))).toBe(false);
  });
});

describe("conditionActiveInRound", () => {
  it("is inactive before fromRound", () => {
    expect(conditionActiveInRound({ id: "prone", fromRound: 3 }, 2)).toBe(false);
  });

  it("covers [fromRound, fromRound + rounds)", () => {
    const cond = { id: "prone" as const, fromRound: 2, rounds: 2 };
    expect(conditionActiveInRound(cond, 1)).toBe(false);
    expect(conditionActiveInRound(cond, 2)).toBe(true);
    expect(conditionActiveInRound(cond, 3)).toBe(true);
    expect(conditionActiveInRound(cond, 4)).toBe(false);
  });

  it("is ongoing from fromRound when rounds is undefined", () => {
    const cond = { id: "blinded" as const, fromRound: 2 };
    expect(conditionActiveInRound(cond, 1)).toBe(false);
    expect(conditionActiveInRound(cond, 99)).toBe(true);
  });
});

describe("activeConditionsInRound", () => {
  it("returns only the conditions live in that round", () => {
    const combatant = {
      ...c("Brunella", 18),
      conditions: [
        { id: "prone" as const, fromRound: 1, rounds: 1 },
        { id: "blinded" as const, fromRound: 2 },
      ],
    };
    expect(activeConditionsInRound(combatant, 1).map((x) => x.id)).toEqual([
      "prone",
    ]);
    expect(activeConditionsInRound(combatant, 2).map((x) => x.id)).toEqual([
      "blinded",
    ]);
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
