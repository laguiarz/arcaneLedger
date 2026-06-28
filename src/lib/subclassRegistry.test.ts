import { describe, it, expect } from "vitest";
import { SUBCLASS_REGISTRY, subclassRegistryKey } from "@/lib/subclassRegistry";

const ctx = {
  abilities: { str: 8, dex: 14, con: 12, int: 10, wis: 12, cha: 18 },
  proficiencyBonus: 3,
  level: 5,
};

describe("bard:lore subclass", () => {
  it("is registered under the bard:lore key", () => {
    expect(SUBCLASS_REGISTRY[subclassRegistryKey("Bard", "Lore")]).toBeTypeOf("function");
  });

  it("grants Cutting Words and Bonus Proficiencies at level >= 3", () => {
    const grants = SUBCLASS_REGISTRY["bard:lore"](ctx);
    const names = (grants.resources ?? []).map((r) => r.name);
    expect(names).toContain("Cutting Words");
    expect(names).toContain("Bonus Proficiencies");
  });

  it("grants nothing before level 3", () => {
    const grants = SUBCLASS_REGISTRY["bard:lore"]({ ...ctx, level: 2 });
    expect(grants.resources ?? []).toHaveLength(0);
  });
});
