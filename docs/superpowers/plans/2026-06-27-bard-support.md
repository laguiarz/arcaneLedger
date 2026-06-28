# Bard Class Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Arcanist's Ledger mechanically correct for a CHA-based, prepared-caster Bard (College of Lore), so the level-5 character Brunella works at the table.

**Architecture:** The data model is already class-agnostic. We add class-DERIVED behavior (read `character.className` at runtime): Jack of All Trades in the skill-modifier math, a prepared-vs-spellbook ritual rule, and a College-of-Lore entry in the subclass registry (for the XML-import path). We also fix a latent INT hardcode in the Spellbook header. Bard class data (Bardic Inspiration, Cutting Words, Bonus Proficiencies, spells) is authored directly in Brunella's library JSON — that authoring is a separate collaborative activity AFTER this code lands.

**Tech Stack:** Vite + React + TypeScript, Zustand store, Vitest, Tailwind.

## Global Constraints

- D&D 5e **2024** rules (PHB 2024).
- One Bash command per call; never chain with `&&`/`||`/`;` (user rule).
- TDD: write the failing test first, watch it fail, implement, watch it pass, commit.
- Branch: `feat/bard-support` (already created from `main`).
- `className` matching is case-insensitive and trimmed (`.trim().toLowerCase()`).
- Do NOT rename existing Wizard-flavored UI copy except the factual ritual subtitle.
- `SUBCLASS_REGISTRY` is applied ONLY during Fight Club XML import, NOT on library JSON load — so library characters author their subclass resources directly in JSON.

---

### Task 1: Jack of All Trades in skill math

**Files:**
- Modify: `src/lib/skills.ts`
- Test: `src/lib/skills.test.ts`

**Interfaces:**
- Consumes: `Character` type, existing `abilityMod`, `skillModifier`, `passivePerception`.
- Produces: `isJackOfAllTrades(c: Character): boolean`; `skillModifier` now adds `floor(PB/2)` to non-proficient, non-expertise checks for bards level ≥ 2 (and `passivePerception`, which delegates to it).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/skills.test.ts` (the existing `makeChar` helper defaults to `className: "Wizard"`, `level: 5`, `proficiencyBonus: 3`, `cha: 8`, `int: 16`, `dex: 14`, `wis: 13`):

```ts
describe("jack of all trades", () => {
  it("adds floor(PB/2) to non-proficient checks for a bard L2+", () => {
    const c = makeChar({ className: "Bard", level: 5 });
    // Arcana INT 16 (+3) + floor(3/2)=1 → 4
    expect(skillModifier(c, "arcana")).toBe(4);
  });

  it("does not stack with proficiency (proficient skill unaffected)", () => {
    const c = makeChar({ className: "Bard", level: 5, skills: { history: { proficient: true } } });
    // INT 16 (+3) + PB 3 = 6 (no extra half)
    expect(skillModifier(c, "history")).toBe(6);
  });

  it("does not stack with expertise", () => {
    const c = makeChar({ className: "Bard", level: 5, skills: { arcana: { expertise: true } } });
    // INT 16 (+3) + 2×PB 3 = 9
    expect(skillModifier(c, "arcana")).toBe(9);
  });

  it("does not apply to non-bards", () => {
    const c = makeChar({ className: "Wizard", level: 5 });
    expect(skillModifier(c, "arcana")).toBe(3);
  });

  it("does not apply to a bard below level 2", () => {
    const c = makeChar({ className: "Bard", level: 1, proficiencyBonus: 2 });
    // INT 16 (+3), no JoAT yet
    expect(skillModifier(c, "arcana")).toBe(3);
  });

  it("applies to passive perception when not proficient", () => {
    const c = makeChar({ className: "Bard", level: 5 });
    // WIS 13 (+1) + floor(3/2)=1 → 2; passive 10 + 2 = 12
    expect(passivePerception(c)).toBe(12);
  });

  it("does not add half-PB to passive perception when proficient", () => {
    const c = makeChar({ className: "Bard", level: 5, skills: { perception: { proficient: true } } });
    // WIS 13 (+1) + PB 3 = 4 → 14
    expect(passivePerception(c)).toBe(14);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/skills.test.ts`
Expected: the new "jack of all trades" cases FAIL (e.g. `arcana` returns 3, expected 4; `isJackOfAllTrades` not exported).

- [ ] **Step 3: Implement Jack of All Trades**

In `src/lib/skills.ts`, add the predicate and update `skillModifier`. Final file:

```ts
import type { Ability, Character, SkillName } from "@/types/character";
import { abilityMod } from "@/store/character";
import { SKILLS_IN_ORDER } from "@/lib/constants";

export { abilityMod };

/** Governing ability for a skill, sourced from the canonical SKILLS_IN_ORDER map. */
const SKILL_ABILITY: Record<SkillName, Ability> = Object.fromEntries(
  SKILLS_IN_ORDER.map((s) => [s.name, s.ability]),
) as Record<SkillName, Ability>;

/**
 * Bard Jack of All Trades (2024, class level 2+): add half proficiency bonus
 * (rounded down) to ability checks that don't already include proficiency.
 */
export function isJackOfAllTrades(c: Character): boolean {
  return c.className.trim().toLowerCase() === "bard" && c.level >= 2;
}

/**
 * Total modifier for a skill check:
 *   abilityMod + (expertise ? 2×PB : proficient ? 1×PB : JoAT ? floor(PB/2) : 0).
 * Expertise implies proficient. A missing skills entry → base ability mod
 * (plus Jack of All Trades if applicable).
 */
export function skillModifier(c: Character, skill: SkillName): number {
  const ability = SKILL_ABILITY[skill];
  const base = abilityMod(c.abilities[ability]);
  const prof = c.skills?.[skill];
  if (prof?.expertise) return base + 2 * c.proficiencyBonus;
  if (prof?.proficient) return base + c.proficiencyBonus;
  if (isJackOfAllTrades(c)) return base + Math.floor(c.proficiencyBonus / 2);
  return base;
}

/** Passive Perception = 10 + Perception skill modifier. */
export function passivePerception(c: Character): number {
  return 10 + skillModifier(c, "perception");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/skills.test.ts`
Expected: PASS (all skills tests, old and new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/skills.ts src/lib/skills.test.ts
git commit -m "feat: apply Bard Jack of All Trades to skill checks"
```

---

### Task 2: `availableRituals` ritual-casting rule

**Files:**
- Modify: `src/store/character.ts`
- Test: `src/store/character.test.ts` (create)

**Interfaces:**
- Consumes: `Character`, `Spell` types.
- Produces: `availableRituals(c: Character): Spell[]` — Wizard → every ritual in `spellbook`; any other class → only rituals that are also in `preparedSpells`.

- [ ] **Step 1: Write the failing test**

Create `src/store/character.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Character, Spell } from "@/types/character";
import { availableRituals } from "@/store/character";

const ritualPrepared: Spell = {
  name: "Detect Magic", level: 1, school: "Divination", ritual: true,
};
const ritualUnprepared: Spell = {
  name: "Illusory Script", level: 1, school: "Illusion", ritual: true,
};
const nonRitual: Spell = {
  name: "Magic Missile", level: 1, school: "Evocation",
};

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    name: "Test",
    className: "Wizard",
    level: 5,
    proficiencyBonus: 3,
    abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 13, cha: 8 },
    savingThrowProficiencies: [],
    hp: { max: 20, current: 20, temp: 0 },
    hitDice: { die: 6, max: 5, spent: 0 },
    spellSlotsMax: {},
    spellSlots: {},
    cantrips: [],
    spellbook: [ritualPrepared, ritualUnprepared, nonRitual],
    preparedSpells: ["Detect Magic"],
    innateSpells: [],
    racialFreeCastsUsed: {},
    resources: [],
    conditions: { active: [], exhaustion: 0 },
    concentration: null,
    ...overrides,
  };
}

describe("availableRituals", () => {
  it("returns every spellbook ritual for a Wizard (Ritual Adept)", () => {
    const names = availableRituals(makeChar()).map((s) => s.name);
    expect(names).toEqual(["Detect Magic", "Illusory Script"]);
  });

  it("returns only prepared rituals for a non-Wizard (e.g. Bard)", () => {
    const names = availableRituals(makeChar({ className: "Bard" })).map((s) => s.name);
    expect(names).toEqual(["Detect Magic"]);
  });

  it("never returns non-ritual spells", () => {
    const names = availableRituals(makeChar()).map((s) => s.name);
    expect(names).not.toContain("Magic Missile");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/store/character.test.ts`
Expected: FAIL — `availableRituals` is not exported.

- [ ] **Step 3: Implement the helper**

In `src/store/character.ts`, add after the existing `preparedNonRituals` function (end of file):

```ts
/**
 * Rituals the character can actually cast as rituals. Wizards (Ritual Adept)
 * cast any ritual in their spellbook even unprepared; every other class can
 * only ritual-cast spells it has prepared (2024 rules).
 */
export function availableRituals(c: Character): Spell[] {
  const rituals = c.spellbook.filter((s) => s.ritual);
  if (c.className.trim().toLowerCase() === "wizard") return rituals;
  return rituals.filter((s) => c.preparedSpells.includes(s.name));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/store/character.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/character.ts src/store/character.test.ts
git commit -m "feat: add availableRituals helper (prepared-only for non-wizards)"
```

---

### Task 3: Wire ritual rule + fix INT hardcode in Spellbook view

**Files:**
- Modify: `src/views/Spellbook.tsx`

**Interfaces:**
- Consumes: `availableRituals`, `spellSaveDc`, `spellAttackBonus` from `@/store/character`.
- Produces: no new exports (UI wiring).

- [ ] **Step 1: Update imports**

Change the store import line (currently `import { useCharacter, preparedNonRituals } from "@/store/character";`) to:

```tsx
import {
  useCharacter,
  preparedNonRituals,
  availableRituals,
  spellSaveDc,
  spellAttackBonus,
} from "@/store/character";
```

- [ ] **Step 2: Use `availableRituals` for the Rituals tab**

Replace the `ritualsAvail` memo (the block currently reading
`const ritualsAvail = useMemo(() => { ... return c.spellbook.filter((s) => s.ritual); }, [c]);`) with:

```tsx
  const ritualsAvail = useMemo(() => availableRituals(c), [c]);
```

- [ ] **Step 3: Fix the INT-hardcoded header subtitle**

Replace the `SectionHeader` subtitle on the "Spell Slot Reservoirs" header (currently
``subtitle={`${c.name} · DC ${(8 + c.proficiencyBonus + Math.floor((c.abilities.int - 10) / 2))} · Atk +${c.proficiencyBonus + Math.floor((c.abilities.int - 10) / 2)}`}``) with:

```tsx
        subtitle={`${c.name} · DC ${spellSaveDc(c)} · Atk +${spellAttackBonus(c)}`}
```

- [ ] **Step 4: Make the Rituals-tab subtitle class-aware (factual only)**

Replace the Rituals `SectionHeader` subtitle (currently
`subtitle="Wizards can cast any ritual from the spellbook (+10 min, no slot)"`) with:

```tsx
          subtitle={
            c.className.trim().toLowerCase() === "wizard"
              ? "Wizards can cast any ritual from the spellbook (+10 min, no slot)"
              : "Cast only prepared rituals (+10 min, no slot)"
          }
```

- [ ] **Step 5: Verify types and build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/views/Spellbook.tsx
git commit -m "fix: spellbook header uses spellcasting ability; prepared-only rituals for non-wizards"
```

---

### Task 4: College of Lore in the subclass registry

**Files:**
- Modify: `src/lib/subclassRegistry.ts`
- Test: `src/lib/subclassRegistry.test.ts` (create)

**Interfaces:**
- Consumes: `SubclassContext`, `SubclassGrants`, `Resource` types; `subclassRegistryKey`.
- Produces: `SUBCLASS_REGISTRY["bard:lore"]` — returns `{}` below level 3; at level ≥ 3 returns `resources` containing "Cutting Words" and "Bonus Proficiencies" passive reminders.

- [ ] **Step 1: Write the failing test**

Create `src/lib/subclassRegistry.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/subclassRegistry.test.ts`
Expected: FAIL — `SUBCLASS_REGISTRY["bard:lore"]` is undefined.

- [ ] **Step 3: Implement `bard:lore`**

In `src/lib/subclassRegistry.ts`, add the grant function just before the
`SUBCLASS_REGISTRY` export:

```ts
/**
 * Bard 2024 — College of Lore.
 * - L3 Bonus Proficiencies: proficiency in three skills of your choice.
 * - L3 Cutting Words: Reaction; spend a Bardic Inspiration use to subtract the
 *   die from a creature's damage roll or successful D20 Test within 60 ft.
 * (L6 Magical Secrets and L14 Peerless Skill are intentionally not modeled yet.)
 */
const bardLore = (ctx: SubclassContext): SubclassGrants => {
  if (ctx.level < 3) return {};
  return {
    resources: [
      {
        name: "Cutting Words",
        source: "Subclass: College of Lore",
        desc:
          "Reaction (Lore L3): when a creature you can see within 60 feet makes a damage roll or succeeds on a D20 Test, expend one use of Bardic Inspiration, roll the die, and subtract the number rolled from the creature's roll — reducing the damage or potentially turning the success into a failure.",
        max: 0,
        used: 0,
        recharge: "manual",
      },
      {
        name: "Bonus Proficiencies",
        source: "Subclass: College of Lore",
        desc:
          "Lore L3: you gain proficiency in three skills of your choice (already reflected in this character's skill list).",
        max: 0,
        used: 0,
        recharge: "manual",
      },
    ],
  };
};
```

Then add the entry to the `SUBCLASS_REGISTRY` object:

```ts
export const SUBCLASS_REGISTRY: Record<string, (ctx: SubclassContext) => SubclassGrants> = {
  "wizard:illusionist": wizardIllusionist,
  "bard:lore": bardLore,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/subclassRegistry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/subclassRegistry.ts src/lib/subclassRegistry.test.ts
git commit -m "feat: add Bard College of Lore to subclass registry"
```

---

### Task 5: Full validation

**Files:** none (verification only).

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all tests pass (previous 15 + new JoAT/ritual/lore tests).

- [ ] **Step 3: Production build**

Run: `npx vite build`
Expected: build succeeds.

---

## Follow-up (separate, collaborative — NOT part of this plan)

After this code lands, author **Brunella** (L5 College of Lore) interactively with the user:
- `public/characters/brunella.json` — abilities (CHA primary), `savingThrowProficiencies: ["dex","cha"]`, `hitDice` d8, `spellcastingAbility: "cha"`, slots `{1:4,2:3,3:2}`, 3 cantrips, 9 prepared spells in `spellbook`, `skills` (2 Expertise + 3 Lore proficiencies + starting profs), `initiativeBonus` (Dex mod + JoAT half-PB), `subclass: "Lore"`, and `resources` authored directly: **Bardic Inspiration** (`max` = CHA mod, `recharge: "short"`, `inspirePhraseDeck: "brunella"`), **Cutting Words**, **Bonus Proficiencies**.
- `public/characters/manifest.json` — add `{ "id": "brunella", "name": "Brunella", "className": "Bard (Lore)", "level": 5 }`.
- `src/data/inspirePhrases.ts` — add a `brunella` deck (phrases written with the user).

## Self-Review

- **Spec coverage:** JoAT → Task 1. Ritual rule → Tasks 2–3. INT fix → Task 3. Lore college → Task 4. Validation → Task 5. Bardic Inspiration / character data → Follow-up (authored in JSON, per the corrected registry-application finding). All spec items mapped.
- **Placeholder scan:** none — every code step contains full code.
- **Type consistency:** `isJackOfAllTrades`, `skillModifier`, `availableRituals`, `SUBCLASS_REGISTRY["bard:lore"]`, `spellSaveDc`, `spellAttackBonus` used consistently across tasks and match existing signatures.
