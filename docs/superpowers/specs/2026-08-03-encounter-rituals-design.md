# Design — A Rituals section on the Encounter page

Date: 2026-08-03
Status: brainstormed with the user 2026-08-03, then **substantially revised after an
adversarial spec review** — see "Revisions after review" at the end. The review found a
pre-existing duplicate-render bug this feature would have triggered, a double-listing the
first draft caused, and a cast button that would have been dead code for every real spell.

## Problem

She added a ritual to Brunella, fixed its visibility on `/spellbook`, and then:

> "ahí quedó ok en /spellbook, pero no lo veo en /encounter. […] esa página tiene todas las
> habilidades que se usan en un encuentro que puede no ser combate también… y es la que más uso."

`/encounter` is the page she plays from. An encounter is not always combat, and rituals are
precisely the out-of-combat tool — but the page has no ritual concept at all.

## What the page does today

- `prepared` (`Encounter.tsx:35-39`) is `[...preparedNonRituals(c), ...preparedRituals(c)]`.
  **`preparedNonRituals` does not do what its name says** (`character.ts:767-771`): it filters
  by `preparedSpells` and never excludes rituals. So the union double-counts, and
  `PreparedGrouped` keys rows by `s.name` (`Encounter.tsx:279`) — a prepared spellbook ritual
  renders **twice, with a duplicate React key**. No shipped character triggers it: Brunella has
  no spellbook rituals, Lyari's two are unprepared. The prepare star shipped today on
  `/spellbook` makes it reachable in one tap.
- Innate rituals (lineage, feat, item) appear under **Innate Casting**, except those bound to an
  item resource — `itemBoundSpellNames` removes those (`Encounter.tsx:49-52`) and they render as
  rows under **Abilities & Items**. Brunella's two Ritual-Grimoire spells are that case.
- An **unprepared spellbook ritual** appears **nowhere**. That is her bug.

## Goals

- Every ritual she can act on is visible on `/encounter`.
- An unprepared spellbook ritual is visible there *and* preparable there, without a trip to
  `/spellbook`.
- **No spell appears twice on the page** — including fixing the pre-existing case above, which
  this feature would otherwise expose.

## Non-goals

- **Moving prepared rituals out of Prepared Spells.** She said to add to what is there.
  Consequence, stated as a known limitation: a prepared ritual still shows only its slot-cast
  button, so ritual-casting it is not offered on this page.
- **A cast affordance in the new section.** See "No cast button" below — this is a real scope
  reduction from the first draft, not an oversight.
- **Giving item-bound or innate rituals a second home.** They already have rows.
- **Enforcing the 10-minute ritual cost.** The app has no clock.
- **Touching `SpellCard`'s inert `ritualMode` button** on `/spellbook` (`SpellCard.tsx:95-105`),
  which renders a Ritual button with an empty `onClick`. It is the same anti-pattern this spec
  argues against and it should be fixed — in its own change, not smuggled into this one.

## Rules

2024 PHB: a spell with the **Ritual** tag can be cast as a ritual only if you **have it
prepared** — casting time +10 minutes, no slot. The Wizard's **Ritual Adept** is the exception:
a Wizard ritual-casts any ritual in the spellbook, prepared or not. Spells granted by an item or
lineage are never "prepared", so preparation never gates them.

## The section

**Placement:** left column, after **Cantrips** — her choice.

**Filter behaviour:** rendered **only under the `All` filter** — her choice, and consistent with
how the page treats things that have no action-economy meaning. Ritualising is never an Action,
Bonus Action or Reaction.

> **Do not add a `rituals.length === 0` term to `nothingMatches`** (`Encounter.tsx:64-69`). It is
> the obvious "consistency" edit and it is wrong: it would make `nothingMatches` false while
> filtering with nothing to show, leaving filter chips over a blank page with no "No action
> options right now." message. The section lives inside the existing `else` branch, gated on
> `!filtering && list.length > 0`.

### Group 1 — Castable now (Wizard-only in practice)

```ts
encounterRituals(c): Spell[]
```
= `availableRituals(c)` minus
- any name in `c.preparedSpells` — already under **Prepared Spells**;
- **any name in `c.innateSpells`** — already under **Innate Casting**, or, when item-bound,
  under **Abilities & Items**. Excluding only the item-bound ones (the first draft) left every
  lineage ritual double-listed: Brunella's **Detect Magic** would have rendered once with a
  free-cast bolt and an `Innate 1/1` chip and again with a ritual affordance, for one spell.
  `itemBoundSpellNames` is kept as a second, defensive subtraction, because a spell can be
  authored into the spellbook and named by an item resource (`findSpell` checks the spellbook
  first).

What that leaves, honestly:
- **Wizard** → the spellbook rituals not prepared. Lyari: *Illusory Script*, *Phantom Steed*.
- **Non-Wizard** → **always empty**, necessarily: `availableRituals` already keeps only *prepared*
  spellbook rituals for them, and this selector subtracts exactly those. Group 1 is a Wizard
  list and group 2 is everyone else's; that is the structure, and it should read as deliberate.

### Group 2 — Needs preparing

The non-Wizard's unprepared spellbook rituals, from `ritualsNeedingPreparation(c)` — already
shipped and tested for `/spellbook` — each with the **prepare star**.

Without this group her own case still fails: Brunella's new custom ritual is an unprepared
spellbook ritual, so group 1 cannot contain it, and `/encounter` would still not show the spell
whose absence started this. Empty for Wizards by definition.

## No cast button

The section renders **no cast affordance at all**. Group 2 gets the prepare star, which does
change tracked state and therefore earns its control.

Per the Ritual-Grimoire decision (PR #23), a control exists only where casting changes something
the app tracks. Ritual-casting a spellbook ritual spends **no slot, no charge, and — for almost
every real ritual — takes no concentration**. Lyari's two are *Illusory Script* and *Phantom
Steed*: neither is concentration. A "Ritual" button there would do literally nothing, which is
the exact failure PR #23 refused to ship.

The first draft kept a button for the concentration case. Dropped, because a concentration
ritual that is in the spellbook, unprepared, and belongs to a Wizard is a set that is empty for
both her characters — building it would be speculative code, and it would open a fresh
`setConcentration` call site with none of the `replaces` warning that `CompactResourceRow`
carries (`CompactResourceRow.tsx:45-51`), re-opening the hole PR #22 closed.

**So the section is a reference list**, and that is the right shape: her complaint was *"no lo
veo"* — visibility was the ask, never a button. If a concentration ritual ever lands in group 1,
the row can gain a bolt then, with the `replaces` chip, as its own change.

## Rendering

A **new `CompactRitualRow`** component, not a mode flag on `CompactSpellRow`.

`CompactCantripRow` already exists as a separate component for exactly this reason: a row with a
different affordance. Threading a `ritualMode` through `CompactSpellRow` would mean branching the
bolt, its `canCast`/`title` logic, the whole free/level picker panel, and the misleading
`Innate {n}/{m}` chip — five branches through a 130-line render, for two modes that would share
only the header strip and the details panel. The name would also collide with `SpellCard`'s
existing `ritualMode`, which means the opposite thing.

`CompactRitualRow` shows: level badge, school icon, name, the `Ritual` chip, a `Custom` chip when
`source === "custom"`, and an expandable details panel — reusing the same markup idiom as its two
neighbours. It takes **`showPrepareToggle?: boolean`** and pulls `togglePrepared` from the store
itself, matching `SpellCard` (`SpellCard.tsx:14`, `:84-93`) rather than inventing a callback prop.

Section header: `SubHeader icon="auto_stories" label="Rituals" count={…}`, matching its
neighbours. Any title text for the ritual chip must match the shipped string,
*"Ritual — casting time + 10 min, no spell slot"* (`CompactResourceRow.tsx:136`).

## Behaviour when empty

The section renders only when at least one group is non-empty. Cantrips has no empty hint either
(`Encounter.tsx:158-165`); only Abilities & Items and Prepared Spells do. A permanent
"Rituals (0)" on her busiest page is noise, and for a character with no rituals it would never
go away.

## Prerequisite: fix the double-render

Before the section is added, `Encounter.tsx:35-39` becomes:

```ts
// preparedNonRituals already returns EVERY prepared spellbook spell, rituals
// included — the name is a lie. Unioning preparedRituals on top rendered each
// prepared ritual twice, with a duplicate React key.
const prepared = useMemo(() => preparedNonRituals(c), [c]);
```

Dropping the redundant union is the whole fix: one line, no behaviour change for anyone without
a prepared ritual, and no effect on `/spellbook`. Renaming or narrowing `preparedNonRituals`
itself is **not** done here — `Spellbook.tsx:55` feeds its Prepared tab from it, so narrowing it
would silently remove prepared rituals from that tab, a change she did not ask for.

## Testing

**Unit — `src/store/character.test.ts`** (extending, reusing `makeChar`), for `encounterRituals`:
- a Wizard gets the unprepared spellbook rituals and **not** the prepared ones;
- innate rituals are **excluded entirely** — the regression guard for the double-listing, using
  a lineage ritual (not item-bound) so it fails if only `itemBoundSpellNames` is subtracted;
- an item-bound ritual is excluded even when also present in the spellbook (defensive path);
- a non-Wizard gets an empty list, with a comment saying that is structural, not incidental;
- non-ritual spells never appear.

**Unit — the prerequisite:** a character with a prepared ritual yields that spell **once** in
whatever `Encounter` builds its prepared list from. Since the fix lives in the view, assert it on
`preparedNonRituals` + `preparedRituals` directly: the union of the two, as the view used to
build it, contains a duplicate — pin that `preparedNonRituals` alone already contains the ritual,
which is what makes dropping the union correct.

**Component, jsdom — `CompactRitualRow`** (new file, `// @vitest-environment jsdom` on line 1,
manual `afterEach(cleanup)`; there are no jest-dom matchers in this repo, so assert on
`textContent` / `toBeTruthy`):
- renders the name, level and `Ritual` chip, and a `Custom` chip only for a custom spell;
- renders **no cast button** in any case;
- with `showPrepareToggle`, the star calls through and `preparedSpells` contains the name after
  the click — asserting the behaviour, not the prop.

**No view test for `<Encounter />`.** This repo has none, and rendering it drags in `HpStrip`,
`ConcentrationBar` and the icon font. The selector carries the logic.

**Manual, headless Chrome** (`$TEMP/uitest/shootnav.mjs`, URL `…/#/encounter` — HashRouter):
- **Precondition:** Brunella has **no** spellbook rituals in `brunella.json`; her custom ritual
  exists only in the per-device stash. So the scenario must **add a custom ritual through the
  spell editor first**, in the same session.
- on **Brunella**: it appears under **Needs preparing**; the star prepares it; it then appears
  under **Prepared Spells exactly once** (the prerequisite fix is what makes this pass);
- her two Ritual-Grimoire rows still appear exactly **once**, under Abilities & Items, and
  **Detect Magic** appears exactly once, under Innate Casting;
- on **Lyari**: *Illusory Script* and *Phantom Steed* appear under **Rituals**, with no button;
- switching the filter to **Action** hides the whole section, and the "No action options" message
  still behaves as it does today.

Verify **within a single browser session**: on this machine Chrome does not reliably commit the
last `localStorage` write before it is killed, so cross-boot assertions are unreliable.

## Risks

- **Double-listing** — the largest risk, which is why both exclusions live in the selector and
  why the innate case has a dedicated test using a lineage ritual.
- **Density** on her busiest page. Mitigated by `All`-only and by rendering nothing when empty.
- **A section that is empty for the character she reported the bug on** until she adds or
  prepares something. Accepted: that is the rules being correct, and group 2 makes it actionable.
- **The prepared-ritual gap** — a prepared ritual still offers only a slot-cast here. Named in
  the non-goals.

## Revisions after review

An adversarial subagent checked every claim against the code and both character JSONs. It
confirmed the item-bound exclusion works as described, that the `All`-only rule cannot collide
with `nothingMatches` as specified, that the Wizard mechanism is right, and that the unit and
jsdom tests are realistic here. Applied:

1. **Blocker — every non-item-bound innate ritual was double-listed.** `availableRituals` unions
   innate rituals and Innate Casting already renders them. Detect Magic would have appeared twice
   on **both** characters, with two different affordances and a free-cast counter that ritual
   casting must not decrement. The selector now subtracts all innate names.
2. **Blocker — a pre-existing duplicate render this feature would have triggered.**
   `preparedNonRituals` does not exclude rituals despite its name, so `Encounter.tsx:35-39`
   renders every prepared ritual twice with a duplicate key. Unreachable today; reachable in one
   tap via the prepare star shipped this morning. Now a prerequisite step, fixed in the view so
   `/spellbook` is untouched.
3. **Blocker — the cast button was dead code.** Applying PR #23's rule to a spell row leaves no
   button for any non-concentration ritual, which is nearly all of them and both of Lyari's. The
   section is now explicitly a reference list, and the concentration case is dropped as
   speculative rather than shipped with a `setConcentration` call site missing the `replaces`
   warning.
4. Group 1 is **Wizard-only** by construction; the first draft's "Brunella: normally empty" was
   wrong about why, and her lineage ritual is a third category the sentence did not admit.
5. `CompactRitualRow` as a separate component, per the `CompactCantripRow` precedent, instead of a
   `ritualMode` flag that would also collide with `SpellCard`'s prop of the same name and opposite
   meaning.
6. `showPrepareToggle` + store instead of an `onPrepare` callback, matching `SpellCard`.
7. The `nothingMatches` prohibition is written down rather than left implicit.
8. The manual test's precondition is stated: Brunella has no spellbook ritual in the repo.
9. Corrected: Cantrips has no empty hint, and the grid-balance justification for the left column
   was false for Brunella (13 rows left vs 12 right). Placement stands — it is her choice — but
   the invented rationale is gone.
10. Chip title matches the shipped string.

## Open questions

None blocking. The two calls originally flagged as mine — including group 2, and excluding
item-bound rows — both survived review and are now load-bearing.
