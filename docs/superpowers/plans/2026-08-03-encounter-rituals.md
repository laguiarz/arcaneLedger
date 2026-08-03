# Encounter Rituals Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a Rituals section on `/encounter` so every ritual she can act on is visible on the page she plays from, and an unprepared one can be prepared without leaving it.

**Architecture:** One new pure selector (`encounterRituals`) carries all the exclusion logic so nothing can be listed twice; one new row component (`CompactRitualRow`) mirrors the existing `CompactCantripRow`; the view wires two groups into the left column under Cantrips, `All` filter only. A pre-existing duplicate-render bug in `Encounter.tsx` is fixed first, because this feature makes it reachable.

**Tech Stack:** React 18, Zustand 5, TypeScript 5.7, Vitest 4 (node env by default, jsdom opted in per file), Tailwind 3.

**Spec:** `docs/superpowers/specs/2026-08-03-encounter-rituals-design.md` — read it before starting; the three blockers it records are the reason this plan is shaped as it is.

## Global Constraints

- Dev server is port **5180**. One command per Bash call; never chain with `&&`.
- Branch is `feat/spell-editor` (this continues the custom-spells work). Never commit on `main`. **Never push without asking.**
- Commit messages go through `git commit -F <file>` (Git Bash).
- New user-facing copy on `/encounter` is **English**.
- The app is a **HashRouter** — browser URLs are `http://localhost:5180/#/encounter`.
- **Do NOT add a `rituals.length === 0` term to `nothingMatches`** (`Encounter.tsx:64-69`). See spec.
- **Do NOT rename or narrow `preparedNonRituals`** — `Spellbook.tsx:55` depends on its current behaviour.
- **Do NOT touch `SpellCard`'s inert `ritualMode` button.** It is a separate change.
- Ritual chip title text must be exactly `"Ritual — casting time + 10 min, no spell slot"`.
- No jest-dom matchers exist in this repo: assert with `.textContent`, `toBeTruthy()`, `toBeNull()`.
- Component tests need `// @vitest-environment jsdom` as the **first line** and a manual `afterEach(cleanup)` — Vitest runs without `globals`, so RTL auto-cleanup never registers.
- Run tests with `npm test`, typecheck with `npm run typecheck`.

---

### Task 1: Fix the pre-existing duplicate render

**Files:**
- Modify: `src/views/Encounter.tsx:35-39`
- Test: `src/store/character.test.ts` (extend)

**Interfaces:**
- Consumes: `preparedNonRituals`, `preparedRituals` from `@/store/character`.
- Produces: nothing new. `prepared` inside `Encounter` becomes a single call.

**Why first:** `preparedNonRituals` does **not** exclude rituals despite its name, so the current union renders every prepared ritual twice with a duplicate React key. No shipped character triggers it — but Task 4's prepare star makes it reachable in one tap, and the spec's acceptance test ("appears under Prepared Spells exactly once") fails without this.

- [ ] **Step 1: Write the failing test**

Append to `src/store/character.test.ts`:

```ts
/**
 * `preparedNonRituals` filters only by preparation — it does NOT exclude
 * rituals, despite the name. Encounter used to union it with preparedRituals,
 * which rendered every prepared ritual twice with a duplicate React key. This
 * pins the behaviour the view now relies on.
 */
describe("preparedNonRituals really includes rituals", () => {
  const ritual: Spell = { name: "Detect Magic", level: 1, school: "Divination", ritual: true };
  const plain: Spell = { name: "Magic Missile", level: 1, school: "Evocation" };

  it("already contains a prepared ritual, so unioning preparedRituals duplicates it", () => {
    const c = makeChar({
      spellbook: [ritual, plain],
      preparedSpells: ["Detect Magic", "Magic Missile"],
    });
    expect(preparedNonRituals(c).map((s) => s.name)).toContain("Detect Magic");

    // The shape the view used to build. Kept as the regression guard: if
    // someone reinstates the union, this count goes back to 2.
    const unioned = [...preparedNonRituals(c), ...preparedRituals(c)].filter(
      (s) => s.name === "Detect Magic",
    );
    expect(unioned).toHaveLength(2);
  });
});
```

Add `preparedNonRituals` and `preparedRituals` to the existing import from `@/store/character` at the top of that file.

- [ ] **Step 2: Run it and confirm it passes**

Run: `npm test -- src/store/character`
Expected: PASS. This test documents current *selector* behaviour — it is green from the start on purpose. The bug is in the view, which has no test; this is the pin that makes the view fix provably safe.

- [ ] **Step 3: Fix the view**

In `src/views/Encounter.tsx`, replace lines 35-39:

```ts
  // `preparedNonRituals` already returns EVERY prepared spellbook spell,
  // rituals included — the name is a lie (see character.ts). Unioning
  // `preparedRituals` on top rendered each prepared ritual twice, with a
  // duplicate React key. Rituals stay in this list by design; the new Rituals
  // section below lists only the ones that are NOT here.
  const prepared = useMemo(() => preparedNonRituals(c), [c]);
```

Then remove `preparedRituals` from the import at `Encounter.tsx:5` — TypeScript will flag it as unused otherwise.

- [ ] **Step 4: Verify**

Run: `npm run typecheck` (expected: clean)
Run: `npm test` (expected: all green)

- [ ] **Step 5: Commit**

```bash
git add src/views/Encounter.tsx src/store/character.test.ts
git commit -F <message file>
```

Message: `fix: stop rendering a prepared ritual twice on the Encounter page`

---

### Task 2: The `encounterRituals` selector

**Files:**
- Modify: `src/store/character.ts` (add beside `ritualsNeedingPreparation`)
- Test: `src/store/character.test.ts` (extend)

**Interfaces:**
- Consumes: `availableRituals` (`character.ts:784`), `itemBoundSpellNames` from `@/lib/itemSpells`.
- Produces: `encounterRituals(c: Character): Spell[]`.

- [ ] **Step 1: Write the failing test**

Append to `src/store/character.test.ts`:

```ts
/**
 * The Rituals section on /encounter must never list a spell the page already
 * shows somewhere else. Every exclusion lives in this selector, not the view.
 */
describe("encounterRituals", () => {
  const bookRitual: Spell = { name: "Illusory Script", level: 1, school: "Illusion", ritual: true };
  const bookRitualPrepared: Spell = { name: "Alarm", level: 1, school: "Abjuration", ritual: true };
  const lineageRitual: Spell = {
    name: "Detect Magic", level: 1, school: "Divination", ritual: true, source: "race",
  };
  const itemRitual: Spell = {
    name: "Guiding Hand", level: 1, school: "Divination", ritual: true, source: "item",
  };

  it("gives a Wizard the unprepared spellbook rituals and not the prepared ones", () => {
    const names = encounterRituals(
      makeChar({
        spellbook: [bookRitual, bookRitualPrepared],
        preparedSpells: ["Alarm"],
        innateSpells: [],
      }),
    ).map((s) => s.name);
    expect(names).toEqual(["Illusory Script"]);
  });

  it("excludes innate rituals entirely — Innate Casting already renders them", () => {
    // The regression guard for the double-listing. A LINEAGE ritual is used on
    // purpose: it is not item-bound, so subtracting only itemBoundSpellNames
    // would let it through and this test would fail.
    const names = encounterRituals(
      makeChar({ spellbook: [bookRitual], preparedSpells: [], innateSpells: [lineageRitual] }),
    ).map((s) => s.name);
    expect(names).toEqual(["Illusory Script"]);
    expect(names).not.toContain("Detect Magic");
  });

  it("excludes an item-bound ritual even when it also sits in the spellbook", () => {
    const names = encounterRituals(
      makeChar({
        spellbook: [bookRitual, itemRitual],
        preparedSpells: [],
        innateSpells: [],
        resources: [
          { name: "Ritual-Grimoire", max: 0, used: 0, recharge: "manual",
            itemSpell: { name: "Guiding Hand" } },
        ],
      }),
    ).map((s) => s.name);
    expect(names).toEqual(["Illusory Script"]);
  });

  it("is empty for a non-Wizard, structurally", () => {
    // availableRituals already keeps only PREPARED spellbook rituals for a
    // non-Wizard, and this selector subtracts exactly those — so group 1 is a
    // Wizard list by construction. The unprepared ones are group 2's job.
    expect(
      encounterRituals(
        makeChar({
          className: "Bard",
          spellbook: [bookRitual, bookRitualPrepared],
          preparedSpells: ["Alarm"],
          innateSpells: [],
        }),
      ),
    ).toEqual([]);
  });

  it("never returns non-ritual spells", () => {
    const names = encounterRituals(
      makeChar({
        spellbook: [{ name: "Magic Missile", level: 1, school: "Evocation" }],
        preparedSpells: [],
        innateSpells: [],
      }),
    ).map((s) => s.name);
    expect(names).toEqual([]);
  });
});
```

Add `encounterRituals` to the import from `@/store/character`.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- src/store/character`
Expected: FAIL — `encounterRituals is not a function`.

- [ ] **Step 3: Implement**

In `src/store/character.ts`, directly after `ritualsNeedingPreparation`:

```ts
/**
 * Rituals for the Encounter page's Rituals section: castable as rituals right
 * now AND not already rendered somewhere else on that page.
 *
 * Subtracts:
 *  - prepared spells — already under "Prepared Spells";
 *  - EVERY innate spell — already under "Innate Casting", or, when bound to an
 *    item resource, under "Abilities & Items". Subtracting only the item-bound
 *    ones leaves lineage rituals double-listed with two different affordances;
 *  - item-bound names, defensively: a spell can be authored into the spellbook
 *    AND named by a resource's `itemSpell`, and `findSpell` resolves the
 *    spellbook copy first.
 *
 * Consequence worth knowing: this is a WIZARD list. `availableRituals` already
 * keeps only prepared spellbook rituals for every other class, and this
 * subtracts exactly those, so a non-Wizard always gets `[]` — their unprepared
 * rituals are `ritualsNeedingPreparation`'s job.
 */
export function encounterRituals(c: Character): Spell[] {
  const innate = new Set(c.innateSpells.map((s) => s.name));
  const itemBound = itemBoundSpellNames(c);
  return availableRituals(c).filter(
    (s) =>
      !c.preparedSpells.includes(s.name) &&
      !innate.has(s.name) &&
      !itemBound.has(s.name),
  );
}
```

Add the import at the top of `character.ts`:

```ts
import { itemBoundSpellNames } from "@/lib/itemSpells";
```

**Check for an import cycle first:** `src/lib/itemSpells.ts` must not import from `@/store/character`. Read it; if it does, inline the two-line name collection here instead of importing.

- [ ] **Step 4: Verify**

Run: `npm test -- src/store/character` (expected: PASS)
Run: `npm run typecheck` (expected: clean)

- [ ] **Step 5: Commit**

```bash
git add src/store/character.ts src/store/character.test.ts
git commit -F <message file>
```

Message: `feat: pick the rituals the Encounter page is not already showing`

---

### Task 3: The `CompactRitualRow` component

**Files:**
- Create: `src/components/encounter/CompactRitualRow.tsx`
- Test: `src/components/encounter/CompactRitualRow.test.tsx`

**Interfaces:**
- Consumes: `togglePrepared` from `useCharacter`; `SCHOOL_COLORS`, `SCHOOL_ICONS`; `SpellComponentsText`.
- Produces: `<CompactRitualRow spell={Spell} showPrepareToggle?={boolean} />`.

Modelled on `CompactCantripRow` (same file, same idiom) — read that file before writing this one. **No cast button in any case**; the star is the only control, and only when `showPrepareToggle`.

- [ ] **Step 1: Write the failing test**

Create `src/components/encounter/CompactRitualRow.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- CompactRitualRow`
Expected: FAIL — cannot resolve `./CompactRitualRow`.

- [ ] **Step 3: Implement**

Create `src/components/encounter/CompactRitualRow.tsx`:

```tsx
import { useState, type ReactNode } from "react";
import type { Spell } from "@/types/character";
import { useCharacter } from "@/store/character";
import Icon from "../ui/Icon";
import { SpellComponentsText } from "../SpellComponentsText";
import { SCHOOL_COLORS, SCHOOL_ICONS } from "@/lib/constants";

const RITUAL_TITLE = "Ritual — casting time + 10 min, no spell slot";

/**
 * A ritual on the Encounter page. Deliberately has NO cast control: ritualising
 * a spellbook ritual spends no slot, no charge and (for every ritual either
 * character owns) takes no concentration, so a button would change nothing the
 * app tracks — the failure PR #23 refused to ship. The star is the exception:
 * preparing is real state.
 */
export default function CompactRitualRow({
  spell,
  showPrepareToggle = false,
}: {
  spell: Spell;
  showPrepareToggle?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const togglePrepared = useCharacter((s) => s.togglePrepared);
  const school = SCHOOL_COLORS[spell.school];

  return (
    <div className="bg-surface-container-low border border-outline-variant/40 rounded-md hover:border-primary/40 transition">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          onClick={() => setOpen((o) => !o)}
        >
          <span
            className={`shrink-0 w-6 h-6 inline-flex items-center justify-center rounded text-[9px] font-bold ${school.chip}`}
            title={spell.school}
          >
            {spell.level}
          </span>
          <Icon name={SCHOOL_ICONS[spell.school]} size={14} className="text-primary/60 shrink-0" />
          <span className="font-serif text-sm text-on-surface truncate flex-1">{spell.name}</span>
          <span title={RITUAL_TITLE} className="inline-flex shrink-0">
            <Icon name="auto_stories" size={12} className="text-outline" />
          </span>
          {spell.source === "custom" && (
            <span
              title="You wrote this one"
              className="shrink-0 chip text-[9px] px-1.5 py-0 border bg-primary/10 text-primary border-primary/30"
            >
              Custom
            </span>
          )}
          <Icon
            name={open ? "expand_less" : "expand_more"}
            size={16}
            className="text-outline shrink-0"
          />
        </button>
        {showPrepareToggle && (
          <button
            type="button"
            className="btn-icon shrink-0"
            aria-label="Prepare"
            title="Prepare so it can be ritual-cast"
            onClick={() => togglePrepared(spell.name)}
          >
            <Icon name="star" />
          </button>
        )}
      </div>
      {open && (
        <div className="px-2 pb-2 pt-1 border-t border-outline-variant/30 animate-fade-in">
          <div className="grid grid-cols-2 gap-x-2 text-[10px]">
            {spell.castingTime && <Meta label="Cast" value={spell.castingTime} />}
            {spell.range && <Meta label="Range" value={spell.range} />}
            {spell.duration && <Meta label="Dur" value={spell.duration} />}
            {spell.components && (
              <Meta
                label="Comp"
                value={
                  <SpellComponentsText
                    components={spell.components}
                    stripped={spell.componentsStripped}
                  />
                }
              />
            )}
          </div>
          {spell.desc && (
            <p className="text-[11px] text-on-surface-variant italic mt-1.5 leading-snug">
              {spell.desc}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1 min-w-0">
      <span className="label-caps text-outline text-[9px] shrink-0">{label}</span>
      <span className="text-on-surface-variant truncate">{value}</span>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm test -- CompactRitualRow` (expected: PASS, 5 tests)
Run: `npm run typecheck` (expected: clean)

- [ ] **Step 5: Commit**

```bash
git add src/components/encounter/CompactRitualRow.tsx src/components/encounter/CompactRitualRow.test.tsx
git commit -F <message file>
```

Message: `feat: a compact ritual row for the Encounter page`

---

### Task 4: Wire the section into the view

**Files:**
- Modify: `src/views/Encounter.tsx`

**Interfaces:**
- Consumes: `encounterRituals` (Task 2), `ritualsNeedingPreparation` (already shipped), `CompactRitualRow` (Task 3).
- Produces: the rendered section. No new exports.

- [ ] **Step 1: Add the imports**

In `src/views/Encounter.tsx`:

```ts
import {
  useCharacter,
  preparedNonRituals,
  encounterRituals,
  ritualsNeedingPreparation,
  spellSaveDc,
  spellAttackBonus,
} from "@/store/character";
```

(`preparedRituals` is already gone from this import, removed in Task 1.)

```ts
import CompactRitualRow from "@/components/encounter/CompactRitualRow";
```

- [ ] **Step 2: Derive the two groups**

Immediately after the `prepared` memo (around line 35-39):

```ts
  // Rituals are not part of the action economy — ritualising is never an
  // Action, Bonus Action or Reaction — so this section is `All`-only and is
  // NOT wired into `nothingMatches`.
  const ritualsCastable = useMemo(() => encounterRituals(c), [c]);
  const ritualsToPrepare = useMemo(() => ritualsNeedingPreparation(c), [c]);
  const showRituals = ritualsCastable.length > 0 || ritualsToPrepare.length > 0;
```

**Do not** add either list to `nothingMatches` (lines 64-69) or to the `showX` flags.

- [ ] **Step 3: Render it**

In the left column, immediately after the `showCantrips` block and still inside the same
`<div className="space-y-2">`:

```tsx
            {/* `All` only: under an action filter this section is meaningless,
                so it disappears rather than lying about what a ritual costs. */}
            {!filtering && showRituals && (
              <>
                <SubHeader
                  icon="auto_stories"
                  label="Rituals"
                  count={ritualsCastable.length + ritualsToPrepare.length}
                />
                {ritualsCastable.map((s) => (
                  <CompactRitualRow key={`ritual-${s.name}`} spell={s} />
                ))}
                {ritualsToPrepare.length > 0 && (
                  <>
                    <p className="text-[10px] text-outline italic px-2 pt-1">
                      Needs preparing — tap the star, then it can be ritual-cast.
                    </p>
                    {ritualsToPrepare.map((s) => (
                      <CompactRitualRow key={`prep-${s.name}`} spell={s} showPrepareToggle />
                    ))}
                  </>
                )}
              </>
            )}
```

The `ritual-` / `prep-` key prefixes match the existing `innate-` convention at line 174 and
guarantee no key collision even if a spell somehow reached both groups.

- [ ] **Step 4: Verify**

Run: `npm run typecheck` (expected: clean)
Run: `npm test` (expected: all green)

- [ ] **Step 5: Commit**

```bash
git add src/views/Encounter.tsx
git commit -F <message file>
```

Message: `feat: show rituals on the page you actually play from`

---

### Task 5: Verification

**Files:** none modified unless a check fails.

- [ ] **Step 1: Suite, typecheck, build**

Run: `npm test` — expected all green; record the new total (was 302).
Run: `npm run typecheck` — expected no output.
Run: `npm run build` — expected success including the `stampLibrary.mjs` guard.

- [ ] **Step 2: Browser, Lyari**

Start `npm run dev` (port 5180, background). Drive with `$TEMP/uitest/shootnav.mjs` against
`http://localhost:5180/#/encounter`.

With **Lyari** active, assert in one session:
- a **Rituals** section exists in the left column;
- it contains **Illusory Script** and **Phantom Steed**;
- neither row has a cast button;
- **Detect Magic** appears exactly **once** on the page (under Innate Casting) — the
  double-listing guard;
- clicking the **Action** filter chip makes the whole Rituals section disappear, and the page
  still behaves as before.

- [ ] **Step 3: Browser, Brunella**

Switch to Brunella via Settings → Library, **in the same session**, then:
- add a custom **ritual** through the spell editor on `/spellbook` (she has no spellbook ritual
  in `brunella.json`, so the section is empty without this — it is a required precondition);
- on `/encounter` it appears under **Rituals** with the "Needs preparing" hint and a star;
- tap the star; it then appears under **Prepared Spells exactly once** — this is the assertion
  Task 1 exists for;
- her two **Ritual-Grimoire** rows still appear exactly once, under Abilities & Items.

**Do everything within one browser session.** On this machine Chrome does not reliably commit the
last `localStorage` write before it is killed, so cross-boot assertions are unreliable. Do not
enable cloud sync in that profile — `.env.local` holds real Upstash credentials and the dev
server writes to production data.

- [ ] **Step 4: Stop the dev server**

Run: `npx kill-port 5180`

- [ ] **Step 5: Report**

State separately what was **verified by running it** and what is only **reasoned**. Then ask her
about pushing — the branch has the whole custom-spells feature on it too, and nothing has been
pushed yet.
