# Custom Spells Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player add, edit and delete her own spells and cantrips from inside the app, syncing them across devices and surviving both a library reload and a character switch.

**Architecture:** Custom spells live in a per-character-id stash on `useCharacter` (the shape `useCoin.purses` already uses), because the `character` object is replaced wholesale by every load. A pure `projectCustoms` function mirrors the stash into `character.spellbook`/`cantrips` as entries tagged `source: "custom"`, so every existing consumer keeps working untouched. The stash is derived into `DurableSheet.customSpells` and rides the existing sync.

**Tech Stack:** React 18, Zustand 5 (`persist`), TypeScript 5.7, Vitest 4 (node env by default, jsdom opted in per file), Tailwind 3.

**Spec:** `docs/superpowers/specs/2026-08-03-custom-spells-design.md`

## Global Constraints

- Dev server is port **5180**. One command per Bash call; never chain with `&&`.
- Branch is `feat/spell-editor`. Never commit on `main`. Never push without asking.
- Commit messages go through `git commit -F <file>` (Git Bash).
- New user-facing copy on the Spellbook page is **English**.
- `useCharacter` persist `version` goes **6 → 7**; `migrate` body stays empty and must **not** rebuild the state object.
- `DurableSheet.customSpells` is **always emitted**, empty arrays included. Empty means "she has none"; absent means "pushed by an older build".
- Spell identity is the `name` string. No ids on spells.
- Test files are colocated as `<name>.test.ts(x)`. Component tests need `// @vitest-environment jsdom` as the **first line**.
- Run the suite with `npm test`, typecheck with `npm run typecheck`.

---

### Task 1: The pure custom-spell module

**Files:**
- Modify: `src/types/character.ts:15-21` (add `"custom"` to `SpellSource`)
- Modify: `src/lib/constants.ts:40` (add `SPELL_SCHOOLS`)
- Create: `src/lib/customSpells.ts`
- Test: `src/lib/customSpells.test.ts`

**Interfaces:**
- Consumes: `Character`, `Spell`, `Cantrip`, `SpellSchool`, `SpellLevel` from `@/types/character`.
- Produces: `CustomSpells`, `CustomSpellDraft`, `emptyCustomSpells()`, `projectCustoms(c, stash)`, `pruneCustoms(c, stash)`, `nameCollides(c, name, ignore?)`, `draftToSpell(draft)`, `draftToCantrip(draft)`, `isCantripDraft(draft)`. Every later task depends on these exact names.

- [ ] **Step 1: Write the failing test**

Create `src/lib/customSpells.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  projectCustoms,
  pruneCustoms,
  nameCollides,
  emptyCustomSpells,
  draftToSpell,
  draftToCantrip,
  isCantripDraft,
} from "./customSpells";
import { sampleWizard } from "@/data/sampleWizard";
import type { Character, Spell, Cantrip } from "@/types/character";

const fireball: Spell = { name: "Fireball", level: 3, school: "Evocation", source: "custom" };
const spark: Cantrip = { name: "Spark", school: "Evocation", source: "custom" };

function base(overrides: Partial<Character> = {}): Character {
  return {
    ...sampleWizard,
    spellbook: [{ name: "Shield", level: 1, school: "Abjuration", source: "class" }],
    cantrips: [{ name: "Fire Bolt", school: "Evocation", source: "class" }],
    innateSpells: [],
    preparedSpells: [],
    ...overrides,
  };
}

describe("projectCustoms", () => {
  it("appends the stash and keeps library entries untouched and in order", () => {
    const next = projectCustoms(base(), { spellbook: [fireball], cantrips: [spark] });
    expect(next.spellbook.map((s) => s.name)).toEqual(["Shield", "Fireball"]);
    expect(next.cantrips.map((s) => s.name)).toEqual(["Fire Bolt", "Spark"]);
  });

  it("is idempotent — reprojecting does not duplicate", () => {
    const stash = { spellbook: [fireball], cantrips: [spark] };
    const once = projectCustoms(base(), stash);
    const twice = projectCustoms(once, stash);
    expect(twice.spellbook.map((s) => s.name)).toEqual(["Shield", "Fireball"]);
    expect(twice.cantrips.map((s) => s.name)).toEqual(["Fire Bolt", "Spark"]);
  });

  it("drops custom entries that are no longer in the stash", () => {
    const projected = projectCustoms(base(), { spellbook: [fireball], cantrips: [] });
    const cleared = projectCustoms(projected, emptyCustomSpells());
    expect(cleared.spellbook.map((s) => s.name)).toEqual(["Shield"]);
  });
});

describe("pruneCustoms", () => {
  it("drops a stash entry the incoming sheet now provides itself (promotion)", () => {
    const incoming = base({
      spellbook: [
        { name: "Shield", level: 1, school: "Abjuration", source: "class" },
        { name: "fireball", level: 3, school: "Evocation", source: "class" },
      ],
    });
    const pruned = pruneCustoms(incoming, { spellbook: [fireball], cantrips: [spark] });
    expect(pruned.spellbook).toHaveLength(0);
    expect(pruned.cantrips.map((s) => s.name)).toEqual(["Spark"]);
  });

  it("keeps entries the incoming sheet does not have", () => {
    const pruned = pruneCustoms(base(), { spellbook: [fireball], cantrips: [] });
    expect(pruned.spellbook.map((s) => s.name)).toEqual(["Fireball"]);
  });
});

describe("nameCollides", () => {
  const c = base({ innateSpells: [{ name: "Misty Step", level: 2, school: "Conjuration" }] });

  it("catches spellbook, cantrip and innate names, ignoring case", () => {
    expect(nameCollides(c, "shield")).toBe(true);
    expect(nameCollides(c, "FIRE BOLT")).toBe(true);
    expect(nameCollides(c, "Misty Step")).toBe(true);
  });

  it("is false for a free name", () => {
    expect(nameCollides(c, "Fireball")).toBe(false);
  });

  it("ignores the spell being renamed", () => {
    expect(nameCollides(c, "Shield", "Shield")).toBe(false);
  });
});

describe("drafts", () => {
  it("routes level 0 to a cantrip and drops leveled-only fields", () => {
    const draft = {
      name: "  Spark  ", level: 0 as const, school: "Evocation" as const,
      ritual: true, concentration: true, desc: "zap",
    };
    expect(isCantripDraft(draft)).toBe(true);
    const cantrip = draftToCantrip(draft);
    expect(cantrip.name).toBe("Spark");
    expect(cantrip.source).toBe("custom");
    expect(cantrip).not.toHaveProperty("ritual");
    expect(cantrip).not.toHaveProperty("level");
  });

  it("keeps ritual and concentration on a leveled spell and omits empty strings", () => {
    const spell = draftToSpell({
      name: "Fireball", level: 3, school: "Evocation", ritual: true,
      concentration: false, range: "", desc: "boom",
    });
    expect(spell).toEqual({
      name: "Fireball", level: 3, school: "Evocation", source: "custom",
      ritual: true, desc: "boom",
    });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- customSpells`
Expected: FAIL — `Failed to resolve import "./customSpells"`.

- [ ] **Step 3: Add `"custom"` to `SpellSource`**

In `src/types/character.ts`, replace the `SpellSource` union:

```ts
export type SpellSource =
  | "class"
  | "subclass"
  | "race"
  | "background"
  | "feat"
  | "item"
  /** Authored in-app by the player. The only source the UI may edit or delete. */
  | "custom";
```

- [ ] **Step 4: Add the runtime school list**

In `src/lib/constants.ts`, directly after `SCHOOL_ICONS` (line 40):

```ts
/**
 * The eight schools as a runtime array. `SpellSchool` is a type and erases at
 * compile time, so the spell form needs this to render its options.
 */
export const SPELL_SCHOOLS = Object.keys(SCHOOL_ICONS) as SpellSchool[];
```

- [ ] **Step 5: Write `src/lib/customSpells.ts`**

```ts
import type {
  Cantrip,
  Character,
  Spell,
  SpellLevel,
  SpellSchool,
} from "@/types/character";

/**
 * The spells the player authored herself, for ONE character. Kept outside the
 * `Character` object because every load replaces that object wholesale — see
 * the stash on `useCharacter`.
 */
export interface CustomSpells {
  spellbook: Spell[];
  cantrips: Cantrip[];
}

export const emptyCustomSpells = (): CustomSpells => ({ spellbook: [], cantrips: [] });

/** What the spell form collects. `level: 0` means "cantrip". */
export interface CustomSpellDraft {
  name: string;
  level: 0 | SpellLevel;
  school: SpellSchool;
  castingTime?: string;
  range?: string;
  components?: string;
  duration?: string;
  desc?: string;
  ritual?: boolean;
  concentration?: boolean;
}

export function isCantripDraft(d: CustomSpellDraft): boolean {
  return d.level === 0;
}

/** Drop undefined and empty-string fields so spells stay comparable by value. */
function compact<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== false),
  ) as T;
}

function commonFields(d: CustomSpellDraft) {
  return {
    name: d.name.trim(),
    school: d.school,
    castingTime: d.castingTime?.trim(),
    range: d.range?.trim(),
    components: d.components?.trim(),
    duration: d.duration?.trim(),
    desc: d.desc?.trim(),
    source: "custom" as const,
  };
}

export function draftToSpell(d: CustomSpellDraft): Spell {
  return compact({
    ...commonFields(d),
    level: (d.level === 0 ? 1 : d.level) as SpellLevel,
    ritual: d.ritual,
    concentration: d.concentration,
  }) as Spell;
}

export function draftToCantrip(d: CustomSpellDraft): Cantrip {
  // `ritual`, `concentration` and `level` are deliberately absent: `Cantrip`
  // has no such fields and level 0 is expressed by living in `cantrips`.
  return compact(commonFields(d)) as Cantrip;
}

/**
 * Replace the character's custom entries with the stash's. Pure and idempotent:
 * every write path (add, edit, delete, load, remote apply) goes through it, so
 * the projection can never drift from the stash.
 *
 * Deliberately does NOT sort. `Spellbook.tsx` already sorts the spellbook with
 * its own comparator and the cantrip grid renders in array order; sorting here
 * would reorder library content on a pull for no gain.
 */
export function projectCustoms(c: Character, stash: CustomSpells): Character {
  return {
    ...c,
    spellbook: [...c.spellbook.filter((s) => s.source !== "custom"), ...stash.spellbook],
    cantrips: [...c.cantrips.filter((s) => s.source !== "custom"), ...stash.cantrips],
  };
}

/**
 * Drop stash entries whose name the incoming sheet now provides itself. This is
 * what makes manual promotion work: once Fireball is committed to the library
 * JSON, the library copy wins and the duplicate custom disappears for good.
 */
export function pruneCustoms(c: Character, stash: CustomSpells): CustomSpells {
  const owned = new Set(
    [...c.spellbook, ...c.cantrips, ...c.innateSpells]
      .filter((s) => s.source !== "custom")
      .map((s) => s.name.trim().toLowerCase()),
  );
  const keep = (s: { name: string }) => !owned.has(s.name.trim().toLowerCase());
  return { spellbook: stash.spellbook.filter(keep), cantrips: stash.cantrips.filter(keep) };
}

/**
 * Is `name` already taken anywhere on the sheet? Name is the identity key for
 * `preparedSpells`, `findSpell` and concentration, so duplicates are refused.
 * `ignore` is the original name when renaming.
 */
export function nameCollides(c: Character, name: string, ignore?: string): boolean {
  const needle = name.trim().toLowerCase();
  const skip = ignore?.trim().toLowerCase();
  if (needle === skip) return false;
  return [...c.spellbook, ...c.cantrips, ...c.innateSpells].some(
    (s) => s.name.trim().toLowerCase() === needle,
  );
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test -- customSpells`
Expected: PASS, 10 tests.

- [ ] **Step 7: Typecheck and commit**

Run: `npm run typecheck` (expected: clean)

```bash
git add src/lib/customSpells.ts src/lib/customSpells.test.ts src/types/character.ts src/lib/constants.ts
git commit -F <message file>
```

Message: `feat: the pure core of player-authored spells`

---

### Task 2: `DurableSheet` carries the custom spells

**Files:**
- Modify: `src/lib/durableSheet.ts:14-40`
- Test: `src/lib/durableSheet.test.ts` (extend)

**Interfaces:**
- Consumes: `CustomSpells` from Task 1.
- Produces: `DurableSheet.customSpells: CustomSpells` (required, always emitted). `applyDurable` is **unchanged** — custom spells are applied by the store action in Task 6, not here.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/durableSheet.test.ts`:

```ts
describe("extractDurable — custom spells", () => {
  it("always emits customSpells, empty arrays included", () => {
    const d = extractDurable(sampleWizard);
    expect(d.customSpells).toEqual({ spellbook: [], cantrips: [] });
  });

  it("picks up custom entries and excludes library ones", () => {
    const c: Character = {
      ...sampleWizard,
      spellbook: [
        { name: "Shield", level: 1, school: "Abjuration", source: "class" },
        { name: "Fireball", level: 3, school: "Evocation", source: "custom" },
      ],
      cantrips: [
        { name: "Fire Bolt", school: "Evocation", source: "class" },
        { name: "Spark", school: "Evocation", source: "custom" },
      ],
    };
    const d = extractDurable(c);
    expect(d.customSpells.spellbook.map((s) => s.name)).toEqual(["Fireball"]);
    expect(d.customSpells.cantrips.map((s) => s.name)).toEqual(["Spark"]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- durableSheet`
Expected: FAIL — `customSpells` is `undefined`.

- [ ] **Step 3: Add the field**

In `src/lib/durableSheet.ts`, import the type and add to the interface:

```ts
import type { CustomSpells } from "@/lib/customSpells";
```

Inside `DurableSheet`, after `narrationPrompt`:

```ts
  /**
   * Spells the player authored in-app. ALWAYS emitted, empty arrays included:
   * an empty list means "she has none", which is how a deletion reaches the
   * other devices. Absent means "pushed by a build that predates this field",
   * which the store's applyRemoteSheet treats as "keep what I have".
   *
   * NOTE: adding this key changes `digestState` for every install, so the first
   * boot after it ships reads as dirty everywhere. Expected, one-time, and
   * harmless because nobody has custom spells yet at that moment.
   */
  customSpells: CustomSpells;
```

In `extractDurable`, after `narrationPrompt: c.narrationPrompt,`:

```ts
    customSpells: {
      spellbook: c.spellbook.filter((s) => s.source === "custom"),
      cantrips: c.cantrips.filter((s) => s.source === "custom"),
    },
```

Leave `applyDurable` alone, and add a comment above it:

```ts
 * Custom spells are NOT applied here — they live in a per-character stash on
 * the store, so `useCharacter.applyRemoteSheet` handles them.
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- durableSheet`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`

```bash
git add src/lib/durableSheet.ts src/lib/durableSheet.test.ts
git commit -F <message file>
```

Message: `feat: carry player-authored spells in the durable sheet`

---

### Task 3: The stash on the store, and adding a spell

**Files:**
- Modify: `src/store/character.ts` (state interface ~25-115, the store body, persist config ~481-501)
- Test: `src/store/character.test.ts` (extend)

**Interfaces:**
- Consumes: everything from Task 1.
- Produces: state field `customSpells: Record<string, CustomSpells>`; action `addCustomSpell(draft: CustomSpellDraft): { ok: true } | { ok: false; error: string }`; internal helper `stashKey(s)`.

- [ ] **Step 1: Write the failing test**

Append to `src/store/character.test.ts`:

```ts
describe("addCustomSpell", () => {
  beforeEach(() => {
    useCharacter.setState({
      character: makeChar({
        spellbook: [{ name: "Shield", level: 1, school: "Abjuration", source: "class" }],
        cantrips: [{ name: "Fire Bolt", school: "Evocation", source: "class" }],
        innateSpells: [{ name: "Misty Step", level: 2, school: "Conjuration" }],
        preparedSpells: [],
      }),
      activeCharacterId: "lyari",
      customSpells: {},
    });
  });

  it("puts a leveled spell in the spellbook and the stash, tagged custom", () => {
    const res = useCharacter.getState().addCustomSpell({
      name: "Fireball", level: 3, school: "Evocation",
    });
    expect(res.ok).toBe(true);
    const s = useCharacter.getState();
    expect(s.character.spellbook.map((x) => x.name)).toEqual(["Shield", "Fireball"]);
    expect(s.character.spellbook[1].source).toBe("custom");
    expect(s.customSpells["lyari"].spellbook).toHaveLength(1);
  });

  it("puts a level 0 spell in the cantrips", () => {
    useCharacter.getState().addCustomSpell({ name: "Spark", level: 0, school: "Evocation" });
    const s = useCharacter.getState();
    expect(s.character.cantrips.map((x) => x.name)).toEqual(["Fire Bolt", "Spark"]);
    expect(s.customSpells["lyari"].cantrips).toHaveLength(1);
  });

  it("refuses a duplicate name across casing, cantrips and innate spells", () => {
    expect(useCharacter.getState().addCustomSpell({
      name: "shield", level: 1, school: "Abjuration",
    })).toEqual({ ok: false, error: expect.stringContaining("already") });

    expect(useCharacter.getState().addCustomSpell({
      name: "Fire Bolt", level: 0, school: "Evocation",
    }).ok).toBe(false);

    expect(useCharacter.getState().addCustomSpell({
      name: "Misty Step", level: 2, school: "Conjuration",
    }).ok).toBe(false);

    expect(useCharacter.getState().customSpells["lyari"]).toBeUndefined();
  });

  it("refuses a blank name", () => {
    expect(useCharacter.getState().addCustomSpell({
      name: "   ", level: 1, school: "Evocation",
    }).ok).toBe(false);
  });

  it("does not auto-prepare", () => {
    useCharacter.getState().addCustomSpell({ name: "Fireball", level: 3, school: "Evocation" });
    expect(useCharacter.getState().character.preparedSpells).toEqual([]);
  });
});
```

Ensure `beforeEach` and the `makeChar` overrides used here are supported — `makeChar` already takes `Partial<Character>` overrides (`character.test.ts:16`). Add `beforeEach` to the vitest import if absent.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- src/store/character`
Expected: FAIL — `addCustomSpell is not a function`.

- [ ] **Step 3: Add the state field and the action**

In `src/store/character.ts`, add the imports:

```ts
import {
  emptyCustomSpells,
  nameCollides,
  projectCustoms,
  pruneCustoms,
  draftToSpell,
  draftToCantrip,
  isCantripDraft,
  type CustomSpells,
  type CustomSpellDraft,
} from "@/lib/customSpells";
```

In `interface CharacterState`, after `libraryRevision`:

```ts
  /**
   * Spells the player authored, keyed by character id — the same shape
   * `useCoin.purses` uses, and for the same reason: `character` is replaced
   * wholesale by every load, so anything that must outlive a reload cannot
   * live inside it. This is the SOURCE OF TRUTH; the tagged entries in
   * `character.spellbook`/`cantrips` are a projection of it.
   */
  customSpells: Record<string, CustomSpells>;
```

And in the Spells action group:

```ts
  /** Add a player-authored spell. Returns an error instead of throwing so the
   *  form can render it inline. */
  addCustomSpell: (draft: CustomSpellDraft) => { ok: true } | { ok: false; error: string };
```

Add the initial value next to `libraryRevision`'s in the store body:

```ts
      customSpells: {},
```

Add a module-level helper above `useCharacter`:

```ts
/** Which stash bucket the active character uses. Imports all share "custom". */
function bucketOf(activeCharacterId: string | null): string {
  return activeCharacterId ?? "custom";
}
```

And the action, in the Spells section of the store body:

```ts
      addCustomSpell: (draft) => {
        const s = get();
        const name = draft.name.trim();
        if (!name) return { ok: false, error: "Name is required." };
        if (nameCollides(s.character, name)) {
          return { ok: false, error: `"${name}" is already on this sheet.` };
        }
        const key = bucketOf(s.activeCharacterId);
        const stash = s.customSpells[key] ?? emptyCustomSpells();
        const next: CustomSpells = isCantripDraft(draft)
          ? { ...stash, cantrips: [...stash.cantrips, draftToCantrip(draft)] }
          : { ...stash, spellbook: [...stash.spellbook, draftToSpell(draft)] };
        set({
          customSpells: { ...s.customSpells, [key]: next },
          character: projectCustoms(s.character, next),
        });
        return { ok: true };
      },
```

- [ ] **Step 4: Bump the persist version**

Replace the persist comment block and `version` (`character.ts:483-490`):

```ts
      // v4: added activeCharacterId for the cloud character library.
      // v5: abilities became base/feat/magic breakdowns. Migrate in place so
      // users keep their active character instead of re-picking.
      // v6: added libraryRevision.
      // v7: added customSpells (player-authored spells, keyed by character id).
      // No migration body needed — zustand's default merge is
      // {...currentState, ...persistedState}, so an absent key already resolves
      // to the initial value. Do NOT rebuild the state object here; that is how
      // you drop activeCharacterId.
      version: 7,
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- src/store/character`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`

```bash
git add src/store/character.ts src/store/character.test.ts
git commit -F <message file>
```

Message: `feat: a per-character stash for the spells you write yourself`

---

### Task 4: Editing and deleting

**Files:**
- Modify: `src/store/character.ts`
- Test: `src/store/character.test.ts` (extend)

**Interfaces:**
- Produces: `updateCustomSpell(originalName: string, draft: CustomSpellDraft): { ok: true } | { ok: false; error: string }` and `removeCustomSpell(name: string): void`.

- [ ] **Step 1: Write the failing test**

Append to `src/store/character.test.ts`:

```ts
describe("updateCustomSpell / removeCustomSpell", () => {
  beforeEach(() => {
    useCharacter.setState({
      character: makeChar({
        spellbook: [{ name: "Shield", level: 1, school: "Abjuration", source: "class" }],
        cantrips: [],
        innateSpells: [],
        preparedSpells: [],
        concentration: null,
      }),
      activeCharacterId: "lyari",
      customSpells: {},
    });
    useCharacter.getState().addCustomSpell({ name: "Fireball", level: 3, school: "Evocation" });
    useCharacter.getState().togglePrepared("Fireball");
    useCharacter.getState().setConcentration("Fireball", 3);
  });

  it("renames, carrying preparation and concentration with it", () => {
    const res = useCharacter.getState().updateCustomSpell("Fireball", {
      name: "Fire Ball", level: 3, school: "Evocation",
    });
    expect(res.ok).toBe(true);
    const s = useCharacter.getState();
    expect(s.character.spellbook.map((x) => x.name)).toEqual(["Shield", "Fire Ball"]);
    expect(s.character.preparedSpells).toEqual(["Fire Ball"]);
    expect(s.character.concentration?.spellName).toBe("Fire Ball");
    expect(s.customSpells["lyari"].spellbook[0].name).toBe("Fire Ball");
  });

  it("refuses a rename onto an existing name but allows keeping its own", () => {
    expect(useCharacter.getState().updateCustomSpell("Fireball", {
      name: "Shield", level: 3, school: "Evocation",
    }).ok).toBe(false);

    expect(useCharacter.getState().updateCustomSpell("Fireball", {
      name: "Fireball", level: 4, school: "Evocation",
    }).ok).toBe(true);
    expect(useCharacter.getState().character.spellbook[1].level).toBe(4);
  });

  it("refuses to move a spell across the cantrip boundary", () => {
    expect(useCharacter.getState().updateCustomSpell("Fireball", {
      name: "Fireball", level: 0, school: "Evocation",
    })).toEqual({ ok: false, error: expect.stringContaining("cantrip") });
  });

  it("refuses to touch a library spell", () => {
    expect(useCharacter.getState().updateCustomSpell("Shield", {
      name: "Shielded", level: 1, school: "Abjuration",
    }).ok).toBe(false);
    useCharacter.getState().removeCustomSpell("Shield");
    expect(useCharacter.getState().character.spellbook.map((x) => x.name)).toContain("Shield");
  });

  it("deletes, pruning preparation and dropping concentration", () => {
    useCharacter.getState().removeCustomSpell("Fireball");
    const s = useCharacter.getState();
    expect(s.character.spellbook.map((x) => x.name)).toEqual(["Shield"]);
    expect(s.character.preparedSpells).toEqual([]);
    expect(s.character.concentration).toBeNull();
    expect(s.customSpells["lyari"].spellbook).toHaveLength(0);
  });

  it("leaves concentration alone when it names a different spell", () => {
    useCharacter.getState().setConcentration("Shield", 1);
    useCharacter.getState().removeCustomSpell("Fireball");
    expect(useCharacter.getState().character.concentration?.spellName).toBe("Shield");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- src/store/character`
Expected: FAIL — `updateCustomSpell is not a function`.

- [ ] **Step 3: Declare the actions**

In `interface CharacterState`, beside `addCustomSpell`:

```ts
  /** Edit a player-authored spell. `originalName` identifies it (names are the
   *  identity key). Level may change within its kind, never across it. */
  updateCustomSpell: (
    originalName: string,
    draft: CustomSpellDraft,
  ) => { ok: true } | { ok: false; error: string };
  /** Delete a player-authored spell, pruning preparation and concentration. */
  removeCustomSpell: (name: string) => void;
```

- [ ] **Step 4: Implement them**

Add a module-level helper above `useCharacter`:

```ts
/** Is `name` in this stash, and as which kind? */
function findInStash(
  stash: CustomSpells,
  name: string,
): { kind: "spell" | "cantrip"; index: number } | null {
  const needle = name.trim().toLowerCase();
  const si = stash.spellbook.findIndex((s) => s.name.trim().toLowerCase() === needle);
  if (si >= 0) return { kind: "spell", index: si };
  const ci = stash.cantrips.findIndex((s) => s.name.trim().toLowerCase() === needle);
  if (ci >= 0) return { kind: "cantrip", index: ci };
  return null;
}
```

And in the store body, after `addCustomSpell`:

```ts
      updateCustomSpell: (originalName, draft) => {
        const s = get();
        const key = bucketOf(s.activeCharacterId);
        const stash = s.customSpells[key] ?? emptyCustomSpells();
        const found = findInStash(stash, originalName);
        // Library spells are not the player's to edit. The UI hides the
        // control; this makes it a property of the model.
        if (!found) return { ok: false, error: "That spell is not yours to edit." };

        const name = draft.name.trim();
        if (!name) return { ok: false, error: "Name is required." };
        if (nameCollides(s.character, name, originalName)) {
          return { ok: false, error: `"${name}" is already on this sheet.` };
        }
        const wantsCantrip = isCantripDraft(draft);
        if (wantsCantrip !== (found.kind === "cantrip")) {
          return {
            ok: false,
            error: "A cantrip cannot become a leveled spell. Delete it and add it again.",
          };
        }

        const next: CustomSpells =
          found.kind === "cantrip"
            ? {
                ...stash,
                cantrips: stash.cantrips.map((x, i) => (i === found.index ? draftToCantrip(draft) : x)),
              }
            : {
                ...stash,
                spellbook: stash.spellbook.map((x, i) => (i === found.index ? draftToSpell(draft) : x)),
              };

        const projected = projectCustoms(s.character, next);
        set({
          customSpells: { ...s.customSpells, [key]: next },
          character: {
            ...projected,
            // Name is the identity key everywhere, so a rename has to be
            // followed through or the spell silently unprepares.
            preparedSpells: projected.preparedSpells.map((n) =>
              n === originalName ? name : n,
            ),
            concentration:
              projected.concentration?.spellName === originalName
                ? { ...projected.concentration, spellName: name }
                : projected.concentration,
          },
        });
        return { ok: true };
      },

      removeCustomSpell: (name) =>
        set((s) => {
          const key = bucketOf(s.activeCharacterId);
          const stash = s.customSpells[key] ?? emptyCustomSpells();
          const found = findInStash(stash, name);
          if (!found) return {};
          const next: CustomSpells =
            found.kind === "cantrip"
              ? { ...stash, cantrips: stash.cantrips.filter((_, i) => i !== found.index) }
              : { ...stash, spellbook: stash.spellbook.filter((_, i) => i !== found.index) };
          const projected = projectCustoms(s.character, next);
          return {
            customSpells: { ...s.customSpells, [key]: next },
            character: {
              ...projected,
              preparedSpells: projected.preparedSpells.filter((n) => n !== name),
              concentration:
                projected.concentration?.spellName === name ? null : projected.concentration,
            },
          };
        }),
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- src/store/character`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`

```bash
git add src/store/character.ts src/store/character.test.ts
git commit -F <message file>
```

Message: `feat: edit and delete the spells you wrote`

---

### Task 5: Surviving a reload and a character switch

**Files:**
- Modify: `src/store/character.ts:450-472` (`loadCharacter`)
- Test: `src/store/character.test.ts` (extend)

**Interfaces:**
- Produces: `loadCharacter` becomes `set((s) => …)`; its signature does not change.

- [ ] **Step 1: Write the failing test**

Append to `src/store/character.test.ts`:

```ts
describe("loadCharacter and the custom-spell stash", () => {
  const lyari = () => makeChar({
    name: "Lyari",
    spellbook: [{ name: "Shield", level: 1, school: "Abjuration", source: "class" }],
    cantrips: [], innateSpells: [], preparedSpells: [],
  });
  const brunella = () => makeChar({
    name: "Brunella",
    spellbook: [{ name: "Vicious Mockery", level: 1, school: "Enchantment", source: "class" }],
    cantrips: [], innateSpells: [], preparedSpells: [],
  });

  beforeEach(() => {
    useCharacter.setState({ character: lyari(), activeCharacterId: "lyari", customSpells: {} });
    useCharacter.getState().addCustomSpell({ name: "Fireball", level: 3, school: "Evocation" });
  });

  it("re-applies the customs when the same character reloads from the library", () => {
    useCharacter.getState().loadCharacter(lyari(), { sourceId: "lyari", revision: "abc" });
    expect(useCharacter.getState().character.spellbook.map((s) => s.name))
      .toEqual(["Shield", "Fireball"]);
  });

  it("does not hand them to a different character, and restores them on the way back", () => {
    useCharacter.getState().loadCharacter(brunella(), { sourceId: "brunella" });
    expect(useCharacter.getState().character.spellbook.map((s) => s.name))
      .toEqual(["Vicious Mockery"]);

    useCharacter.getState().loadCharacter(lyari(), { sourceId: "lyari" });
    expect(useCharacter.getState().character.spellbook.map((s) => s.name))
      .toEqual(["Shield", "Fireball"]);
  });

  it("drops a custom the library now provides itself (promotion)", () => {
    const promoted = makeChar({
      name: "Lyari",
      spellbook: [
        { name: "Shield", level: 1, school: "Abjuration", source: "class" },
        { name: "Fireball", level: 3, school: "Evocation", source: "class" },
      ],
      cantrips: [], innateSpells: [], preparedSpells: [],
    });
    useCharacter.getState().loadCharacter(promoted, { sourceId: "lyari" });
    const s = useCharacter.getState();
    expect(s.character.spellbook.filter((x) => x.name === "Fireball")).toHaveLength(1);
    expect(s.character.spellbook.find((x) => x.name === "Fireball")?.source).toBe("class");
    expect(s.customSpells["lyari"].spellbook).toHaveLength(0);
  });

  it("clears the shared custom bucket on an import", () => {
    // Every Settings import lands in the same "custom" id, so spells typed for
    // one imported sheet must not follow her onto the next.
    useCharacter.getState().loadCharacter(brunella());
    expect(useCharacter.getState().activeCharacterId).toBe("custom");
    expect(useCharacter.getState().character.spellbook.map((s) => s.name))
      .toEqual(["Vicious Mockery"]);
    useCharacter.getState().addCustomSpell({ name: "Bless", level: 1, school: "Enchantment" });
    useCharacter.getState().loadCharacter(lyari());
    expect(useCharacter.getState().character.spellbook.map((s) => s.name)).toEqual(["Shield"]);
    expect(useCharacter.getState().customSpells["custom"]).toEqual({ spellbook: [], cantrips: [] });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- src/store/character`
Expected: FAIL — customs are not re-applied after a reload.

- [ ] **Step 3: Rewrite `loadCharacter`**

Replace the whole `loadCharacter` entry (`character.ts:450-472`):

```ts
      loadCharacter: (c, opts) =>
        set((s) => {
          const sourceGiven = Boolean(opts && "sourceId" in opts);
          // Default to "custom" when the caller didn't tell us where the
          // character came from (e.g. Settings file import).
          const nextId = sourceGiven ? (opts!.sourceId ?? null) : "custom";
          const key = bucketOf(nextId);

          const incoming: Character = {
            ...c,
            // Tolerate older saves / hand-edited JSON missing the new fields.
            innateSpells: c.innateSpells ?? [],
            weapons: c.weapons ?? [],
            racialFreeCastsUsed: c.racialFreeCastsUsed ?? {},
            hitDice: c.hitDice ?? { die: 8, max: c.level, spent: 0 },
            // Library JSON and hand-edited files may author abilities as plain
            // numbers; coerce to the base/feat/magic breakdown shape.
            abilities: normalizeAbilities(c.abilities),
          };

          // An import is a declared fresh start, and EVERY import shares the id
          // "custom" — so without clearing, spells typed for one imported sheet
          // would follow her onto the next.
          const stash = sourceGiven
            ? pruneCustoms(incoming, s.customSpells[key] ?? emptyCustomSpells())
            : emptyCustomSpells();

          return {
            character: projectCustoms(incoming, stash),
            customSpells: { ...s.customSpells, [key]: stash },
            activeCharacterId: nextId,
            // An import has no library origin, so it must CLEAR any revision
            // left over from the character it replaced — otherwise the header
            // would compare a custom sheet against someone else's library entry.
            libraryRevision: sourceGiven ? (opts!.revision ?? null) : null,
          };
        }),
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/store/character`
Expected: PASS. Re-run the whole suite (`npm test`) — `loadCharacter` origin tracking is already covered by existing tests and must stay green.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`

```bash
git add src/store/character.ts src/store/character.test.ts
git commit -F <message file>
```

Message: `feat: your spells survive Ficha and switching characters`

---

### Task 6: The remote apply, and the baseline that must stay honest

**Files:**
- Modify: `src/store/character.ts` (add `applyRemoteSheet`)
- Modify: `src/lib/syncFlags.ts` (add `baselineFromRemote`)
- Modify: `src/store/sync.ts:176-186`
- Test: `src/store/character.test.ts`, `src/lib/syncFlags.test.ts`

**Interfaces:**
- Produces: `applyRemoteSheet(cid: string, sheet: DurableSheet): void` on `useCharacter`; `baselineFromRemote(remote: { sheet: unknown; coin: unknown }): string` in `syncFlags.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `src/store/character.test.ts`:

```ts
describe("applyRemoteSheet", () => {
  beforeEach(() => {
    useCharacter.setState({
      character: makeChar({
        spellbook: [{ name: "Shield", level: 1, school: "Abjuration", source: "class" }],
        cantrips: [], innateSpells: [], preparedSpells: [],
      }),
      activeCharacterId: "lyari",
      customSpells: {},
    });
    useCharacter.getState().addCustomSpell({ name: "Fireball", level: 3, school: "Evocation" });
  });

  it("takes the remote customs when the remote has them", () => {
    const sheet = extractDurable(useCharacter.getState().character);
    useCharacter.getState().applyRemoteSheet("lyari", {
      ...sheet,
      customSpells: {
        spellbook: [{ name: "Counterspell", level: 3, school: "Abjuration", source: "custom" }],
        cantrips: [],
      },
    });
    const s = useCharacter.getState();
    expect(s.character.spellbook.map((x) => x.name)).toEqual(["Shield", "Counterspell"]);
    expect(s.customSpells["lyari"].spellbook.map((x) => x.name)).toEqual(["Counterspell"]);
  });

  it("keeps the local ones when the remote sheet predates the field", () => {
    const sheet = extractDurable(useCharacter.getState().character);
    // What a device on an older build pushes: no customSpells key at all.
    const stale = { ...sheet } as Record<string, unknown>;
    delete stale.customSpells;
    useCharacter.getState().applyRemoteSheet("lyari", stale as never);
    expect(useCharacter.getState().character.spellbook.map((x) => x.name))
      .toEqual(["Shield", "Fireball"]);
  });

  it("applies an empty remote list as a deletion", () => {
    const sheet = extractDurable(useCharacter.getState().character);
    useCharacter.getState().applyRemoteSheet("lyari", {
      ...sheet,
      customSpells: { spellbook: [], cantrips: [] },
    });
    expect(useCharacter.getState().character.spellbook.map((x) => x.name)).toEqual(["Shield"]);
  });
});
```

Add `import { extractDurable } from "@/lib/durableSheet";` to that test file.

Append to `src/lib/syncFlags.test.ts`:

```ts
describe("baselineFromRemote", () => {
  it("leaves the device dirty when a backfill kept data the cloud lacks", () => {
    const coin = { startingGold: 0, entries: [], treasure: [] };
    const remoteSheet = { hpMax: 30 }; // an older build: no customSpells key
    const localAfterBackfill = {
      sheet: { hpMax: 30, customSpells: { spellbook: [{ name: "Fireball" }], cantrips: [] } },
      coin,
    };
    const flags = syncFlags({
      baseline: baselineFromRemote({ sheet: remoteSheet, coin }),
      current: digestState(localAfterBackfill),
      lastAppliedUpdatedAt: 5,
      remoteUpdatedAt: 5,
      enabled: true,
    });
    // The cloud holds none of her spells, so the header MUST keep offering
    // Guardar rather than claiming "synced".
    expect(flags.dirty).toBe(true);
  });

  it("reads clean when local and remote agree", () => {
    const payload = { sheet: { hpMax: 30, customSpells: { spellbook: [], cantrips: [] } }, coin: {} };
    const flags = syncFlags({
      baseline: baselineFromRemote(payload),
      current: digestState(payload),
      lastAppliedUpdatedAt: 5,
      remoteUpdatedAt: 5,
      enabled: true,
    });
    expect(flags.dirty).toBe(false);
  });
});
```

Add `baselineFromRemote` to that file's import from `./syncFlags`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- syncFlags`
Expected: FAIL — `baselineFromRemote is not a function`.

- [ ] **Step 3: Add `baselineFromRemote`**

In `src/lib/syncFlags.ts`, after `digestState`:

```ts
/**
 * The baseline to record after a pull: the digest of what the CLOUD holds, not
 * of what this device ended up with. The two differ whenever an apply kept
 * local data the remote lacked (a backfill), and in that case the device
 * genuinely does have unsaved work — recording the merged result instead would
 * render a green "synced" over a cloud that is missing her data.
 */
export function baselineFromRemote(remote: { sheet: unknown; coin: unknown }): string {
  return digestState({ sheet: remote.sheet, coin: remote.coin });
}
```

- [ ] **Step 4: Add `applyRemoteSheet` to the character store**

Declare it in `CharacterState`, after `loadCharacter`:

```ts
  /**
   * Apply a durable sheet pulled from the cloud. Separate from `applyDurable`
   * because custom spells live in the per-character stash, not in the sheet
   * object — and because an older build's sheet has no `customSpells` key at
   * all, which means "I know nothing", never "delete them".
   */
  applyRemoteSheet: (cid: string, sheet: DurableSheet) => void;
```

Add `import { applyDurable, type DurableSheet } from "@/lib/durableSheet";` to `character.ts`.

Implement it in the store body after `loadCharacter`:

```ts
      applyRemoteSheet: (cid, sheet) =>
        set((s) => {
          const applied = applyDurable(s.character, sheet);
          // Absent (older build) → keep what we have. Present-but-empty → she
          // deleted them, and that deletion is meant to travel.
          const stash = sheet.customSpells ?? s.customSpells[cid] ?? emptyCustomSpells();
          return {
            character: projectCustoms(applied, stash),
            customSpells: { ...s.customSpells, [cid]: stash },
          };
        }),
```

- [ ] **Step 5: Wire the pull path**

In `src/store/sync.ts`, replace the `useCharacter.setState(...)` call at lines 176-178 with:

```ts
          useCharacter.getState().applyRemoteSheet(cid, remote.sheet as DurableSheet);
```

Replace the baseline line (182-186) with:

```ts
      // The baseline is what the CLOUD holds, not what we merged into: a
      // backfill that kept local data the remote lacked must leave this device
      // dirty, so the header keeps offering Guardar.
      if (remote) setBaseline(baselineFromRemote(remote));
```

Update the import on line 7 to `import { digestState, syncFlags, baselineFromRemote } from "@/lib/syncFlags";`. Remove the now-unused `applyDurable` import on line 5 if TypeScript flags it (keep `extractDurable`).

- [ ] **Step 6: Run the tests**

Run: `npm test -- syncFlags`
Expected: PASS.
Run: `npm test -- src/store/character`
Expected: PASS.
Run: `npm test`
Expected: all green — `src/store/sync.test.ts` exercises the pull path and must stay passing.

- [ ] **Step 7: Typecheck and commit**

Run: `npm run typecheck`

```bash
git add src/store/character.ts src/store/sync.ts src/lib/syncFlags.ts src/lib/syncFlags.test.ts src/store/character.test.ts
git commit -F <message file>
```

Message: `fix: stop claiming synced when the cloud is missing your spells`

---

### Task 7: The form

**Files:**
- Create: `src/components/spells/SpellForm.tsx`
- Test: `src/components/spells/SpellForm.test.tsx`
- Modify: `src/views/Spellbook.tsx` (add the `+ Add spell` button and mount the form)

**Interfaces:**
- Consumes: `CustomSpellDraft`, `SPELL_SCHOOLS`, `SPELL_LEVELS`, `addCustomSpell`, `updateCustomSpell`.
- Produces: `<SpellForm editing={Spell | Cantrip | null} onClose={() => void} />`. `editing === null` means "add".

- [ ] **Step 1: Write the failing test**

Create `src/components/spells/SpellForm.test.tsx` (jsdom docblock MUST be line 1):

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("SpellForm", () => {
  it("adds a leveled spell to the store", async () => {
    const user = userEvent.setup();
    render(<SpellForm editing={null} onClose={() => {}} />);
    await user.type(screen.getByLabelText("Name"), "Fireball");
    await user.selectOptions(screen.getByLabelText("Level"), "3");
    await user.selectOptions(screen.getByLabelText("School"), "Evocation");
    await user.click(screen.getByRole("button", { name: "Save spell" }));
    expect(useCharacter.getState().character.spellbook.map((s) => s.name))
      .toEqual(["Shield", "Fireball"]);
  });

  it("blocks a duplicate name with an inline message", async () => {
    const user = userEvent.setup();
    render(<SpellForm editing={null} onClose={() => {}} />);
    await user.type(screen.getByLabelText("Name"), "shield");
    await user.click(screen.getByRole("button", { name: "Save spell" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/already on this sheet/i);
    expect(useCharacter.getState().character.spellbook).toHaveLength(1);
  });

  it("requires a name", async () => {
    const user = userEvent.setup();
    render(<SpellForm editing={null} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Save spell" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/name is required/i);
  });

  it("hides ritual and concentration for a cantrip", async () => {
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
});
```

Note: `toHaveTextContent` needs `@testing-library/jest-dom`, which this repo does **not** have. Use `expect((await screen.findByRole("alert")).textContent).toMatch(/already on this sheet/i);` instead — check `HeaderStatus.test.tsx` for the assertion style already in use and match it.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- SpellForm`
Expected: FAIL — cannot resolve `./SpellForm`.

- [ ] **Step 3: Write `src/components/spells/SpellForm.tsx`**

```tsx
import { useState } from "react";
import { useCharacter } from "@/store/character";
import { SPELL_LEVELS, SPELL_SCHOOLS } from "@/lib/constants";
import type { CustomSpellDraft } from "@/lib/customSpells";
import type { Cantrip, Spell, SpellLevel, SpellSchool } from "@/types/character";
import Icon from "@/components/ui/Icon";

interface Props {
  /** The spell being edited, or null to add a new one. */
  editing: Spell | Cantrip | null;
  onClose: () => void;
}

function initialDraft(editing: Spell | Cantrip | null): CustomSpellDraft {
  if (!editing) return { name: "", level: 1, school: "Evocation" };
  const leveled = "level" in editing ? (editing as Spell) : null;
  return {
    name: editing.name,
    level: leveled ? leveled.level : 0,
    school: editing.school,
    castingTime: editing.castingTime ?? "",
    range: editing.range ?? "",
    components: editing.components ?? "",
    duration: editing.duration ?? "",
    desc: editing.desc ?? "",
    ritual: leveled?.ritual ?? false,
    concentration: leveled?.concentration ?? false,
  };
}

export default function SpellForm({ editing, onClose }: Props) {
  const add = useCharacter((s) => s.addCustomSpell);
  const update = useCharacter((s) => s.updateCustomSpell);
  const [draft, setDraft] = useState<CustomSpellDraft>(() => initialDraft(editing));
  const [error, setError] = useState<string | null>(null);

  const isCantrip = draft.level === 0;
  const set = <K extends keyof CustomSpellDraft>(k: K, v: CustomSpellDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const submit = () => {
    const res = editing ? update(editing.name, draft) : add(draft);
    if (res.ok) onClose();
    else setError(res.error);
  };

  return (
    <div className="bg-surface-container-high border border-outline-variant/30 rounded-xl p-md space-y-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-title-sm text-primary">
          {editing ? "Edit spell" : "Add spell"}
        </h3>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
        <label className="block sm:col-span-3">
          <span className="label-caps text-outline block mb-1">Name</span>
          <input
            className="input-inset w-full"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="label-caps text-outline block mb-1">Level</span>
          <select
            className="input-inset w-full"
            value={draft.level}
            onChange={(e) => set("level", Number(e.target.value) as 0 | SpellLevel)}
          >
            <option value={0}>Cantrip</option>
            {SPELL_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="label-caps text-outline block mb-1">School</span>
          <select
            className="input-inset w-full"
            value={draft.school}
            onChange={(e) => set("school", e.target.value as SpellSchool)}
          >
            {SPELL_SCHOOLS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <TextField label="Cast Time" value={draft.castingTime ?? ""} onChange={(v) => set("castingTime", v)} />
        <TextField label="Range" value={draft.range ?? ""} onChange={(v) => set("range", v)} />
        <TextField label="Components" value={draft.components ?? ""} onChange={(v) => set("components", v)} />
        <TextField label="Duration" value={draft.duration ?? ""} onChange={(v) => set("duration", v)} />
      </div>

      {/* Cantrips have neither field on the type, so offering them would lie. */}
      {!isCantrip && (
        <div className="flex flex-wrap gap-md">
          <Check label="Ritual" checked={draft.ritual ?? false} onChange={(v) => set("ritual", v)} />
          <Check
            label="Concentration"
            checked={draft.concentration ?? false}
            onChange={(v) => set("concentration", v)}
          />
        </div>
      )}

      <label className="block">
        <span className="label-caps text-outline block mb-1">Description</span>
        <textarea
          className="input-inset w-full min-h-24"
          value={draft.desc ?? ""}
          onChange={(e) => set("desc", e.target.value)}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-error">{error}</p>
      )}

      <div className="flex justify-end gap-sm">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-brass" onClick={submit}>
          <Icon name="check" /> Save spell
        </button>
      </div>
    </div>
  );
}

function TextField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="label-caps text-outline block mb-1">{label}</span>
      <input className="input-inset w-full" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Check({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
```

If `btn-ghost` is not an existing utility class in `src/index.css`, use the same classes the Cancel button of another form in the repo uses — check `src/components/combat/NarrationModal.tsx`. Do not invent new global classes.

- [ ] **Step 4: Run the tests**

Run: `npm test -- SpellForm`
Expected: PASS.

- [ ] **Step 5: Mount it in the Spellbook view**

In `src/views/Spellbook.tsx`:

Add imports:

```tsx
import SpellForm from "@/components/spells/SpellForm";
import type { Cantrip } from "@/types/character";
```

Add state beside the existing `useState` calls:

```tsx
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Spell | Cantrip | null>(null);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (s: Spell | Cantrip) => { setEditing(s); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };
```

In the toolbar row, immediately before the search `<div className="ml-auto relative">`, insert:

```tsx
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-sm py-2 rounded-md border border-primary/40 bg-surface-container-low text-primary text-sm font-bold tracking-wide transition hover:bg-primary/15"
        >
          <Icon name="add" size={16} /> Add spell
        </button>
```

and change the search wrapper's `ml-auto` so the button sits before it (keep `ml-auto` on the search div; the button will simply precede it).

Directly under the toolbar `</div>` (before the `tab === "prepared"` block), insert:

```tsx
      {formOpen && <SpellForm editing={editing} onClose={closeForm} />}
```

- [ ] **Step 6: Verify in the browser**

Run: `npm run dev` (port 5180), open `/spellbook`, add a spell, confirm it appears in the Spellbook tab and is searchable.

- [ ] **Step 7: Typecheck and commit**

Run: `npm run typecheck`
Run: `npm test`

```bash
git add src/components/spells/SpellForm.tsx src/components/spells/SpellForm.test.tsx src/views/Spellbook.tsx
git commit -F <message file>
```

Message: `feat: a form for writing your own spells`

---

### Task 8: Marking them, and reaching edit and delete

**Files:**
- Modify: `src/components/SpellCard.tsx` (`SpellCard` action row + `CantripCard`)
- Modify: `src/views/Spellbook.tsx` (pass the handlers down)
- Modify: `src/components/encounter/CompactSpellRow.tsx`, `src/components/encounter/CompactCantripRow.tsx` (chip only)
- Test: `src/components/spells/CustomSpellControls.test.tsx` (new)

**Interfaces:**
- Consumes: `removeCustomSpell` from Task 4, `openEdit` from Task 7.
- Produces: `SpellCard` and `CantripCard` accept `onEdit?: (s) => void`. Both render a `Custom` chip and edit/delete when `spell.source === "custom"`.

- [ ] **Step 1: Write the failing test**

Create `src/components/spells/CustomSpellControls.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SpellCard from "@/components/SpellCard";
import { useCharacter } from "@/store/character";
import { sampleWizard } from "@/data/sampleWizard";
import type { Spell } from "@/types/character";

const mine: Spell = { name: "Fireball", level: 3, school: "Evocation", source: "custom" };
const theirs: Spell = { name: "Shield", level: 1, school: "Abjuration", source: "class" };

beforeEach(() => {
  useCharacter.setState({
    character: { ...sampleWizard, spellbook: [theirs, mine], cantrips: [], innateSpells: [], preparedSpells: [] },
    activeCharacterId: "lyari",
    customSpells: { lyari: { spellbook: [mine], cantrips: [] } },
  });
});

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
    expect(useCharacter.getState().character.spellbook.map((s) => s.name))
      .toEqual(["Shield", "Fireball"]);
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- CustomSpellControls`
Expected: FAIL — no "Custom" text, no such buttons.

- [ ] **Step 3: Add a shared controls component**

Create `src/components/spells/CustomSpellControls.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useCharacter } from "@/store/character";
import Icon from "@/components/ui/Icon";
import type { Cantrip, Spell } from "@/types/character";

/**
 * Edit + delete for a player-authored spell. Delete is a two-step inline
 * confirm rather than a dialog: a hand-typed description is real work to lose,
 * but a modal on every delete is the interruption the user has already
 * rejected elsewhere.
 */
export default function CustomSpellControls({
  spell,
  onEdit,
}: {
  spell: Spell | Cantrip;
  onEdit?: (s: Spell | Cantrip) => void;
}) {
  const remove = useCharacter((s) => s.removeCustomSpell);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <>
      {onEdit && (
        <button
          type="button"
          className="btn-icon"
          aria-label="Edit spell"
          title="Edit spell"
          onClick={() => onEdit(spell)}
        >
          <Icon name="edit" />
        </button>
      )}
      <button
        type="button"
        className={`btn-icon ${confirming ? "!text-error !border-error/50 !bg-error/15" : ""}`}
        aria-label={confirming ? "Confirm delete" : "Delete spell"}
        title={confirming ? "Tap again to delete" : "Delete spell"}
        onClick={() => {
          if (confirming) remove(spell.name);
          else setConfirming(true);
        }}
      >
        <Icon name={confirming ? "delete_forever" : "delete"} />
      </button>
    </>
  );
}

/** The badge that says "you wrote this one". */
export function CustomChip() {
  return (
    <span className="chip bg-primary-container/60 text-primary border border-primary/30">
      Custom
    </span>
  );
}
```

- [ ] **Step 4: Wire it into `SpellCard`**

In `src/components/SpellCard.tsx`:

Add to the imports:

```tsx
import CustomSpellControls, { CustomChip } from "@/components/spells/CustomSpellControls";
import type { Cantrip } from "@/types/character";
```

Extend `Props`:

```tsx
  /** Provided only where editing belongs (the Spellbook page, not Encounter). */
  onEdit?: (s: Spell | Cantrip) => void;
```

and the signature: `export default function SpellCard({ spell, ritualMode = false, showPrepareToggle = false, onEdit }: Props) {`

Add the chip inside the chip row, after the `concentration` chip (line 60):

```tsx
              {spell.source === "custom" && <CustomChip />}
```

Add the controls in the action row, as the FIRST children of `<div className="flex items-center gap-1">` (line 70):

```tsx
            {spell.source === "custom" && (
              <CustomSpellControls spell={spell} onEdit={onEdit} />
            )}
```

- [ ] **Step 5: Give `CantripCard` an action row**

Replace the `CantripCard` header block so the toggle is a button and the controls sit beside it, rather than the whole card being one click target:

```tsx
export function CantripCard({
  spell,
  onEdit,
}: {
  spell: Cantrip;
  onEdit?: (s: Spell | Cantrip) => void;
}) {
  const [open, setOpen] = useState(false);
  const school = SCHOOL_COLORS[spell.school];
  return (
    <div className="group relative glass-card brass-border rounded-xl overflow-hidden">
      <div className="leather-noise absolute inset-0" />
      <div className="relative p-sm">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={SCHOOL_ICONS[spell.school]} className="text-primary/70" />
            <span className="font-serif text-on-surface truncate">{spell.name}</span>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            {spell.source === "custom" && <CustomChip />}
            <span className={`chip ${school.chip}`}>{spell.school}</span>
            {spell.source === "custom" && (
              <CustomSpellControls spell={spell} onEdit={onEdit} />
            )}
          </div>
        </div>
        {open && (
          <>
            <SpellMeta spell={spell as never} />
            {spell.desc && (
              <p className="text-sm text-on-surface-variant italic mt-2">{spell.desc}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

Remove the now-unused inline `import("@/types/character").Cantrip` annotation.

- [ ] **Step 6: Pass `onEdit` from the Spellbook view**

In `src/views/Spellbook.tsx`, add `onEdit={openEdit}` to **every** `<SpellCard …>` and `<CantripCard …>` usage (the prepared tab, the rituals tab, the all/spellbook tab, and the cantrips grid).

- [ ] **Step 7: Add the chip to the Encounter rows**

In `src/components/encounter/CompactSpellRow.tsx` and `src/components/encounter/CompactCantripRow.tsx`, render `<CustomChip />` beside the existing source chips when `spell.source === "custom"`. **Do not** add edit or delete here — a delete button next to a cast button mid-combat is a bad idea.

- [ ] **Step 8: Run the tests**

Run: `npm test -- CustomSpellControls`
Expected: PASS.
Run: `npm test`
Expected: all green.

- [ ] **Step 9: Typecheck and commit**

Run: `npm run typecheck`

```bash
git add src/components/spells src/components/SpellCard.tsx src/views/Spellbook.tsx src/components/encounter/CompactSpellRow.tsx src/components/encounter/CompactCantripRow.tsx
git commit -F <message file>
```

Message: `feat: mark, edit and delete the spells that are yours`

---

### Task 9: Verification

**Files:** none modified unless a check fails.

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: every test passes, including the 257 that already existed. Record the new total.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no output.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success, including the `stampLibrary.mjs` guard.

- [ ] **Step 4: Browser check across two boots**

Run `npm run dev` (port 5180) and drive it with `$TEMP/uitest/shootp.mjs` using a **persistent profile**, because the survival claims span a reload:

1. Add a leveled spell and a cantrip; confirm both show the `Custom` chip.
2. Prepare the leveled one; confirm it appears in the Prepared tab.
3. Edit it, rename it, and confirm it stays prepared.
4. Reload the character from the library (**Ficha**); confirm both survive.
5. Switch to Brunella, confirm they are gone; switch back to Lyari, confirm they return.
6. Delete one with the two-step confirm.

Navigate to `about:blank` before the final screenshot so late `localStorage` writes flush.

**Do not** enable cloud sync in that profile — `.env.local` holds real Upstash credentials and the dev server writes to production data.

- [ ] **Step 5: Report**

State separately what was **verified by running it** and what is only **reasoned**. The cross-device round trip is reasoned only; say so.
