import { describe, it, expect } from "vitest";
import type { Combatant } from "@/types/combat";
import { buildNarrationPayload, hasNarratableActions } from "@/lib/combatLog";

function make(partial: Partial<Combatant> & { name: string }): Combatant {
  return {
    id: partial.name,
    name: partial.name,
    kind: partial.kind ?? "pc",
    initiative: partial.initiative ?? null,
    initiativeBonus: partial.initiativeBonus,
    hp: partial.hp,
    ac: partial.ac,
    conditions: partial.conditions ?? [],
    actions: partial.actions ?? {},
    sourceId: partial.sourceId,
  };
}

describe("hasNarratableActions", () => {
  it("is false when nobody acted", () => {
    expect(hasNarratableActions([make({ name: "Brunella" })])).toBe(false);
  });
  it("is true once someone has acted", () => {
    const c = make({ name: "Brunella", actions: { 1: { acted: true } } });
    expect(hasNarratableActions([c])).toBe(true);
  });
});

describe("buildNarrationPayload", () => {
  const brunella = make({
    name: "Brunella",
    kind: "pc",
    initiative: 18,
    actions: { 1: { acted: true, text: "casts Vicious Mockery at the Cube" } },
  });
  const cube = make({
    name: "Gelatinous Cube",
    kind: "monster",
    initiative: 9,
    actions: { 1: { acted: true, text: "engulf Lyari" } },
    conditions: [{ id: "prone", fromRound: 1, rounds: 2 }],
  });

  it("lists combatants in initiative order", () => {
    const text = buildNarrationPayload([cube, brunella], 1, "Brunella");
    const bIdx = text.indexOf("Brunella (pc");
    const cIdx = text.indexOf("Gelatinous Cube (monster");
    expect(bIdx).toBeGreaterThan(-1);
    expect(cIdx).toBeGreaterThan(bIdx);
  });

  it("includes round actions with their detail text", () => {
    const text = buildNarrationPayload([brunella, cube], 1);
    expect(text).toContain("Round 1:");
    expect(text).toContain("Brunella: casts Vicious Mockery at the Cube");
    expect(text).toContain("Gelatinous Cube: engulf Lyari");
  });

  it("renders a bare 'acts' when only the acted flag is set", () => {
    const silent = make({ name: "Lyari", actions: { 1: { acted: true } } });
    const text = buildNarrationPayload([silent], 1);
    expect(text).toContain("Lyari: acts");
  });

  it("skips rounds where nobody acted", () => {
    const text = buildNarrationPayload([brunella], 3);
    expect(text).toContain("Round 1:");
    expect(text).not.toContain("Round 2:");
  });

  it("reports conditions active in each round", () => {
    const text = buildNarrationPayload([cube], 2);
    // prone applies in rounds 1-2 (fromRound 1, rounds 2)
    expect(text).toContain("Conditions: Gelatinous Cube is Prone");
  });

  it("excludes inactive combatants (initiative 0)", () => {
    const benched = make({
      name: "Armathor",
      initiative: 0,
      actions: { 1: { acted: true, text: "should not appear" } },
    });
    const text = buildNarrationPayload([brunella, benched], 1);
    expect(text).not.toContain("Armathor");
    expect(text).not.toContain("should not appear");
  });

  it("includes the point-of-view character when provided", () => {
    const text = buildNarrationPayload([brunella], 1, "Brunella");
    expect(text).toContain("point-of-view character: Brunella");
  });
});
