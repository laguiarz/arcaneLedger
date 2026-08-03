# Ritual-Grimoire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Brunella a Ritual-Grimoire holding Wild Cunning and Guiding Hand, as two chargeless rows in Abilities & Items.

**Architecture:** No new types. `max: 0` already means "no counter", which is exactly what a chargeless item spell is. The work is moving `CompactResourceRow`'s cast affordance out of the `isCounter` branch and off `remaining`, plus a `Ritual` chip and a one-function fix so the Ritual Archive stops ignoring innate rituals.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind, Vitest (+ jsdom per file).

**Spec:** `docs/superpowers/specs/2026-08-02-ritual-grimoire-design.md` — read it; it carries the reviewer's three blockers and explains why each site changes.

## Global Constraints

- Branch `feat/ritual-grimoire`. Never commit on `main`; never push without asking.
- UI copy is **English** (Encounter and Dashboard are English pages).
- Vitest globals are OFF: import `describe/it/expect` explicitly; component tests need
  `// @vitest-environment jsdom` on line 1 and their own `afterEach(cleanup)`.
- **A chargeless row has `remaining === 0`.** Any surviving `remaining <= 0` on the cast path
  is the bug this whole plan exists to avoid.
- One Bash command per call; never chain with `&&`.
- After every task: `npx tsc --noEmit`, then `npx vitest run`.

---

### Task 1: Extract the item-bound spell-name set

**Files:** Create `src/lib/itemSpells.ts`, `src/lib/itemSpells.test.ts`; modify `src/views/Encounter.tsx`.

**Interfaces:** Produces `itemBoundSpellNames(c: Character): Set<string>`.

- [ ] **Step 1: Write the failing test** — `src/lib/itemSpells.test.ts`

```ts
import { describe, it, expect } from "vitest";
import type { Character, Resource } from "@/types/character";
import { itemBoundSpellNames } from "./itemSpells";

const res = (over: Partial<Resource>): Resource => ({
  name: "r", max: 0, used: 0, recharge: "manual", ...over,
});

function charWith(resources: Resource[]): Character {
  return { resources } as Character;
}

describe("itemBoundSpellNames", () => {
  it("collects every resource's item spell", () => {
    const c = charWith([
      res({ name: "Bow", itemSpell: { name: "Ensnaring Strike" } }),
      res({ name: "Book", itemSpell: { name: "Guiding Hand" } }),
    ]);
    expect(itemBoundSpellNames(c)).toEqual(
      new Set(["Ensnaring Strike", "Guiding Hand"]),
    );
  });

  it("ignores resources with no item spell", () => {
    expect(itemBoundSpellNames(charWith([res({ name: "Bardic" })])).size).toBe(0);
  });

  it("is empty for a character with no resources", () => {
    expect(itemBoundSpellNames(charWith([])).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run it, expect failure** — `npx vitest run src/lib/itemSpells.test.ts` → cannot resolve `./itemSpells`.

- [ ] **Step 3: Implement** — `src/lib/itemSpells.ts`

```ts
import type { Character } from "@/types/character";

/**
 * Names of spells that are cast from an item's row rather than from the spell
 * lists. The Encounter view subtracts these from Innate Casting: left in, they
 * would render a second Cast button backed by spell slots, which for a spell
 * off your class list is a cast you cannot legally make.
 *
 * Pure and separate from the view so it can be tested without rendering the
 * whole Encounter page.
 */
export function itemBoundSpellNames(c: Character): Set<string> {
  return new Set(c.resources.flatMap((r) => (r.itemSpell ? [r.itemSpell.name] : [])));
}
```

- [ ] **Step 4: Use it in the view** — in `src/views/Encounter.tsx`, add `import { itemBoundSpellNames } from "@/lib/itemSpells";` and replace the inline `const itemSpellNames = new Set(...)` construction with `const itemSpellNames = itemBoundSpellNames(c);`, keeping the surrounding comment.

- [ ] **Step 5: Verify** — `npx vitest run src/lib/itemSpells.test.ts` → PASS 3. Then `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/itemSpells.ts src/lib/itemSpells.test.ts src/views/Encounter.tsx
git commit -m "refactor: extract itemBoundSpellNames so it can be tested"
```

---

### Task 2: The Ritual Archive stops ignoring innate rituals

**Files:** Modify `src/store/character.ts` (`availableRituals`); modify `src/store/character.test.ts`.

- [ ] **Step 1: Write the failing tests** — append to `src/store/character.test.ts`, matching the existing `makeChar`/fixture style already in that file

```ts
describe("availableRituals with innate rituals", () => {
  const innateRitual = { name: "Detect Magic", level: 1, school: "Divination", ritual: true } as Spell;

  it("includes innate rituals for a non-Wizard", () => {
    const c = makeChar({
      className: "Bard",
      spellbook: [],
      preparedSpells: [],
      innateSpells: [innateRitual],
    });
    expect(availableRituals(c).map((s) => s.name)).toContain("Detect Magic");
  });

  it("still hides an unprepared spellbook ritual from a non-Wizard", () => {
    const c = makeChar({
      className: "Bard",
      spellbook: [{ name: "Identify", level: 1, school: "Divination", ritual: true } as Spell],
      preparedSpells: [],
      innateSpells: [],
    });
    expect(availableRituals(c).map((s) => s.name)).not.toContain("Identify");
  });

  it("still gives a Wizard every spellbook ritual, plus innate ones", () => {
    const c = makeChar({
      className: "Wizard",
      spellbook: [{ name: "Identify", level: 1, school: "Divination", ritual: true } as Spell],
      preparedSpells: [],
      innateSpells: [innateRitual],
    });
    expect(availableRituals(c).map((s) => s.name).sort()).toEqual(["Detect Magic", "Identify"]);
  });
});
```

Adjust the fixture helper name and imports to whatever `character.test.ts` already uses.

- [ ] **Step 2: Run, expect the first and third to fail** — `npx vitest run src/store/character.test.ts`.

- [ ] **Step 3: Implement** — in `src/store/character.ts`, replace the body of `availableRituals`:

```ts
export function availableRituals(c: Character): Spell[] {
  const fromBook = c.spellbook.filter((s) => s.ritual);
  const book =
    c.className.trim().toLowerCase() === "wizard"
      ? fromBook
      : fromBook.filter((s) => c.preparedSpells.includes(s.name));
  // Innate rituals — lineage, feat, item — are always available: there is no
  // preparation step for a spell that was never prepared in the first place.
  // Without this an item literally called Ritual-Grimoire has its rituals
  // missing from the page called Ritual Archive, and so does High Elf Detect Magic.
  return [...book, ...c.innateSpells.filter((s) => s.ritual)];
}
```

- [ ] **Step 4: Verify** — `npx vitest run src/store/character.test.ts` → all PASS. Then `npx vitest run`.

- [ ] **Step 5: Commit**

```bash
git add src/store/character.ts src/store/character.test.ts
git commit -m "fix: the Ritual Archive was ignoring innate rituals"
```

---

### Task 3: Chargeless item spells in `CompactResourceRow`

**Files:** Modify `src/components/encounter/CompactResourceRow.tsx`, `src/components/encounter/CompactResourceRow.test.tsx`.

- [ ] **Step 1: Write the failing tests** — append to the existing describe file

```tsx
const guidingHand: Spell = {
  name: "Guiding Hand", level: 1, school: "Divination",
  castingTime: "1 minute", duration: "Concentration, up to 8 hours",
  desc: "You manifest a tiny luminous hand…", ritual: true, concentration: true, source: "item",
};
const wildCunning: Spell = {
  name: "Wild Cunning", level: 1, school: "Transmutation",
  castingTime: "Action", duration: "Instantaneous",
  desc: "You invoke nature spirits for aid…", ritual: true, source: "item",
};
const chargeless = (name: string): Resource => ({
  name, source: "Ritual-Grimoire", max: 0, used: 0, recharge: "manual",
  itemSpell: { name },
});

describe("a chargeless item spell", () => {
  it("gives a concentration ritual an enabled bolt", () => {
    seedSpells([guidingHand], chargeless("Guiding Hand"));
    render(<CompactResourceRow resource={chargeless("Guiding Hand")} />);
    const b = screen.getByRole("button", { name: /cast guiding hand/i }) as HTMLButtonElement;
    expect(b.disabled).toBe(false);
  });

  it("does not promise a charge it does not spend", () => {
    seedSpells([guidingHand], chargeless("Guiding Hand"));
    render(<CompactResourceRow resource={chargeless("Guiding Hand")} />);
    expect(screen.queryByRole("button", { name: /spends 1 charge/i })).toBeNull();
  });

  it("takes concentration when cast", () => {
    seedSpells([guidingHand], chargeless("Guiding Hand"));
    render(<CompactResourceRow resource={chargeless("Guiding Hand")} />);
    fireEvent.click(screen.getByRole("button", { name: /cast guiding hand/i }));
    expect(useCharacter.getState().character.concentration?.spellName).toBe("Guiding Hand");
  });

  it("warns about replacing concentration with the row collapsed", () => {
    seedSpells([guidingHand], chargeless("Guiding Hand"), {
      spellName: "Faerie Fire", level: 1, rounds: 2,
    });
    render(<CompactResourceRow resource={chargeless("Guiding Hand")} />);
    expect(screen.getByText(/drops faerie fire/i)).toBeTruthy();
  });

  it("gives a non-concentration ritual no bolt at all", () => {
    seedSpells([wildCunning], chargeless("Wild Cunning"));
    render(<CompactResourceRow resource={chargeless("Wild Cunning")} />);
    expect(screen.queryByRole("button", { name: /^cast /i })).toBeNull();
  });

  it("is not labelled passive", () => {
    seedSpells([wildCunning], chargeless("Wild Cunning"));
    render(<CompactResourceRow resource={chargeless("Wild Cunning")} />);
    expect(screen.queryByText(/passive/i)).toBeNull();
  });

  it("IS labelled passive when the reference dangles", () => {
    seedSpells([], chargeless("Nothing Here"));
    render(<CompactResourceRow resource={chargeless("Nothing Here")} />);
    expect(screen.getByText(/passive/i)).toBeTruthy();
  });

  it("shows a Ritual chip", () => {
    seedSpells([wildCunning], chargeless("Wild Cunning"));
    render(<CompactResourceRow resource={chargeless("Wild Cunning")} />);
    expect(screen.getByText(/^ritual$/i)).toBeTruthy();
  });

  it("shows no DC line when the item has no save DC", () => {
    seedSpells([guidingHand], chargeless("Guiding Hand"));
    render(<CompactResourceRow resource={chargeless("Guiding Hand")} />);
    fireEvent.click(screen.getByRole("button", { name: /toggle details/i }));
    expect(screen.queryByText(/DC \d+ \(yours\)/)).toBeNull();
  });
});
```

Add a `seedSpells(spells, resource, concentration = null)` helper beside the existing `seed`, setting `innateSpells: spells`, `resources: [resource]`, `concentration`.

- [ ] **Step 2: Run, expect failures** — `npx vitest run src/components/encounter/CompactResourceRow.test.tsx`.

- [ ] **Step 3: Rewrite the derived values**

Replace the block from `const remaining = …` down to the end of `castFromItem` with:

```ts
  const remaining = resource.max - resource.used;
  const isCounter = resource.max > 0;
  // No counter at all: an item spell with unlimited use, like a ritual grimoire.
  const chargeless = resource.max === 0;

  // findSpell searches the spellbook AND innateSpells — the same lookup
  // ConcentrationBar uses, so the row and the bar can never disagree.
  const itemSpell = resource.itemSpell
    ? findSpell(c, resource.itemSpell.name)
    : undefined;

  // `remaining` is 0 on a chargeless row, so nothing on the cast path may test it.
  const castable = Boolean(itemSpell) && (chargeless || remaining > 0);
  // The bolt only exists where casting changes something the app tracks. A
  // chargeless, non-concentration spell changes nothing, and a button that does
  // nothing teaches you the app's buttons are unreliable.
  const showsBolt = Boolean(itemSpell) && (itemSpell!.concentration || !chargeless);

  // setConcentration overwrites without asking, so name what will be lost.
  const replaces =
    itemSpell?.concentration &&
    c.concentration &&
    c.concentration.spellName !== itemSpell.name
      ? c.concentration.spellName
      : null;

  function castFromItem() {
    if (!itemSpell || !castable) return;
    // Chargeless items spend nothing; useResource would be a no-op at max 0
    // anyway, but saying so is clearer than relying on that.
    if (!chargeless) useResource(resource.name);
    if (itemSpell.concentration) {
      setConcentration(itemSpell.name, itemSpell.level);
    }
  }

  /** The bolt, shared by the counter and chargeless branches. */
  const boltButton = showsBolt && (
    <button
      onClick={itemSpell ? castFromItem : () => useResource(resource.name)}
      disabled={!castable}
      className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md border transition ${
        castable
          ? "bg-primary/15 border-primary/50 text-primary hover:bg-primary/25"
          : "bg-surface-container-low border-outline-variant/40 text-outline cursor-not-allowed"
      }`}
      aria-label={
        itemSpell
          ? chargeless
            ? `Cast ${itemSpell.name}`
            : `Cast ${itemSpell.name} — spends 1 charge`
          : "Use"
      }
      title={
        !castable
          ? "Depleted"
          : replaces
            ? `Cast ${itemSpell!.name} — drops concentration on ${replaces}`
            : chargeless
              ? `Cast ${itemSpell!.name}`
              : `Cast ${itemSpell!.name} — spends 1 charge`
      }
    >
      <Icon name="bolt" filled size={16} />
    </button>
  );

  /** Visible with the row collapsed: nothing hovers on a tablet. */
  const replacesChip = replaces && (
    <span
      className="shrink-0 text-[10px] text-error"
      title={`Casting drops your concentration on ${replaces}`}
    >
      drops {replaces}
    </span>
  );
```

- [ ] **Step 4: Rework the row body**

In the counter branch, delete the inline `{replaces && …}` span and the inline bolt `<button>`, and use `{replacesChip}` where the span was and `{boltButton}` where the button was. **Keep** the plain-`Use` bolt working for counters with no item spell: for those, `showsBolt` is `Boolean(undefined) && …` → `false`, so add the non-item case back by changing `showsBolt` to:

```ts
  const showsBolt = itemSpell ? itemSpell.concentration || !chargeless : isCounter;
```

Then replace the `: (<span …>passive</span>)` alternative with:

```tsx
        ) : (
          <>
            {replacesChip}
            {boltButton}
            {/* Suppressed on the RESOLVED spell: a dangling reference has no
                controls at all, and a row with nothing in it looks broken. */}
            {!itemSpell && (
              <span className="text-[10px] text-outline italic shrink-0">passive</span>
            )}
          </>
        )}
```

- [ ] **Step 5: Add the Ritual chip**

Immediately after the name button, add:

```tsx
        {itemSpell?.ritual && (
          <span
            className="shrink-0 text-[9px] uppercase tracking-wider text-tertiary border border-tertiary/40 bg-tertiary/10 rounded px-1 py-0.5"
            title="Ritual — casting time + 10 min, no spell slot"
          >
            Ritual
          </span>
        )}
```

- [ ] **Step 6: Make the DC line all-or-nothing**

Replace the DC `<p>` in the details block with:

```tsx
              {/* All or nothing: without an item DC this would have printed
                  "DC 15 (yours)" for a spell that has no saving throw. */}
              {resource.itemSpell?.saveDc !== undefined && (
                <p className="text-[10px] text-outline font-mono">
                  <span className="text-on-surface-variant">{itemSpell.name}</span>
                  {" · "}
                  <span>DC {resource.itemSpell.saveDc} (item) · </span>
                  <span>DC {spellSaveDc(c)} (yours)</span>
                </p>
              )}
```

- [ ] **Step 7: Verify** — `npx vitest run src/components/encounter/CompactResourceRow.test.tsx` → all PASS, including the pre-existing bow tests. Then `npx tsc --noEmit`, then `npx vitest run`.

- [ ] **Step 8: Commit**

```bash
git add src/components/encounter/CompactResourceRow.tsx src/components/encounter/CompactResourceRow.test.tsx
git commit -m "feat: items can grant spells with no charges"
```

---

### Task 4: The Ritual chip on the Dashboard renderer

**Files:** Modify `src/components/panels/ResourcesPanel.tsx`.

- [ ] **Step 1: Resolve the spell in `ResourceCard`**

Add `import { findSpell } from "@/store/character";` (extend the existing import), and inside `ResourceCard`:

```ts
  const c = useCharacter((s) => s.character);
  const itemSpell = resource.itemSpell ? findSpell(c, resource.itemSpell.name) : undefined;
```

- [ ] **Step 2: Render the chip beside the existing ones**

After the `RECHARGE_TONE` chip, add:

```tsx
              {itemSpell?.ritual && (
                <span
                  className="chip border border-tertiary/40 bg-tertiary/10 text-tertiary"
                  title="Ritual — casting time + 10 min, no spell slot"
                >
                  Ritual
                </span>
              )}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit`, then `npx vitest run`.

- [ ] **Step 4: Commit**

```bash
git add src/components/panels/ResourcesPanel.tsx
git commit -m "feat: show the Ritual chip on the Dashboard too"
```

---

### Task 5: Brunella's grimoire

**Files:** Modify `public/characters/brunella.json`, `src/lib/characterData.test.ts`.

- [ ] **Step 1: Add both spells to `innateSpells`** (full UA text, `ritual: true`, `source: "item"`) — see the spec's Rules research section for the verbatim wording. Each `desc` ends with:

```
Granted by the Ritual-Grimoire; cast in ritual mode only (casting time + 10 minutes, no spell slot).

Source: Unearthed Arcana 36 — Starter Spells (2017). Playtest material, not published in any Player's Handbook.
```

- [ ] **Step 2: Add both resources**, exactly as in the spec's Data model section: `max: 0`, `used: 0`, `recharge: "manual"`, `source: "Ritual-Grimoire"`, `itemSpell: { "name": … }`, no `actionType`, no `saveDc`.

- [ ] **Step 3: Extend the data test** — append to `src/lib/characterData.test.ts`

```ts
describe("brunella's Ritual-Grimoire", () => {
  const c = load(brunella);
  const rows = c.resources.filter((r) => r.source === "Ritual-Grimoire");

  it("has one row per ritual", () => {
    expect(rows.map((r) => r.name).sort()).toEqual(["Guiding Hand", "Wild Cunning"]);
  });

  it("carries no charges", () => {
    for (const r of rows) expect(r.max).toBe(0);
  });

  it("points at spells flagged as rituals", () => {
    for (const r of rows) {
      const s = c.innateSpells.find((x) => x.name === r.itemSpell!.name);
      expect(s?.ritual, `${r.name} is not flagged ritual`).toBe(true);
    }
  });

  it("keeps Guiding Hand's concentration", () => {
    expect(c.innateSpells.find((s) => s.name === "Guiding Hand")?.concentration).toBe(true);
  });
});
```

- [ ] **Step 4: Verify** — `npx vitest run src/lib/characterData.test.ts`, then `npx tsc --noEmit`, `npx vitest run`, `npx vite build`.

- [ ] **Step 5: Commit**

```bash
git add public/characters/brunella.json src/lib/characterData.test.ts
git commit -m "feat: give Brunella the Ritual-Grimoire"
```

---

### Task 6: Verify in a real browser

- [ ] **Step 1:** `npm run dev` in the background; confirm port **5180**.
- [ ] **Step 2:** Write `%TEMP%\uitest\scenario-grimoire.js` and run it through `$TEMP/uitest/shoot.mjs`, asserting: the build stamp; both rows present under Abilities & Items with a `Ritual` chip; Guiding Hand has an **enabled** bolt whose click takes concentration and leaves no counter; Wild Cunning has **no** bolt and no `passive` label; `Wild Cunning` and `Guiding Hand` each appear **exactly once** on the Encounter page; the Ritual Archive in Spellbook now lists both plus Detect Magic. Save a screenshot and **look at it**.
- [ ] **Step 3:** Fix anything the browser reveals, re-run the suite, re-drive.
- [ ] **Step 4:** `npx kill-port 5180`.

---

## Self-review

**Spec coverage.** `castable` at all four sites → Task 3 Step 3. `replaces` hoisted → Task 3 Steps 3–4. Bolt only where state changes → Task 3. Accessible name → Task 3. `passive` on the resolved spell → Task 3 Step 4. DC all-or-nothing → Task 3 Step 6. Ritual chip both renderers → Tasks 3 and 4. `availableRituals` union → Task 2. Extracted filter → Task 1. Data + tests → Task 5. Browser → Task 6. No gaps.

**Placeholders.** None — every code step carries the code. Task 5 Step 1 defers the spell text to the spec, which quotes it verbatim; that is a pointer to committed content, not a TODO.

**Type consistency.** `castable`, `chargeless`, `showsBolt`, `boltButton`, `replacesChip` are introduced in Task 3 Step 3 and used with those exact names in Steps 4–6. `itemBoundSpellNames` returns `Set<string>` in Task 1 and is consumed as one. `availableRituals` keeps its `(c: Character) => Spell[]` signature.
