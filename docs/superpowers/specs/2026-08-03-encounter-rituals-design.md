# Design — A Rituals section on the Encounter page

Date: 2026-08-03
Status: brainstormed with the user 2026-08-03, after she tested the custom-spells feature.
Two calls were made by me and are flagged **DECISION (mine)** below — veto either freely.

## Problem

She added a ritual to Brunella, fixed its visibility on `/spellbook`, and then:

> "ahí quedó ok en /spellbook, pero no lo veo en /encounter. […] esa página tiene todas las
> habilidades que se usan en un encuentro que puede no ser combate también… y es la que más uso."

`/encounter` is the page she actually plays from. An encounter is not always combat, and
rituals are precisely the out-of-combat tool — but the page has no ritual concept at all.

## What the page does today

- `prepared` (Encounter.tsx:35-39) is `preparedNonRituals` **plus** `preparedRituals`, merged
  and sorted. So a *prepared* ritual already appears, under **Prepared Spells**, rendered as an
  ordinary `CompactSpellRow` — with a slot-spending Cast button and **no ritual affordance**.
- Innate rituals (lineage, feat, item) appear under **Innate Casting**, except those bound to an
  item resource: `itemBoundSpellNames` removes them, and they render instead as rows under
  **Abilities & Items** with their own cast button. Brunella's two Ritual-Grimoire spells are
  exactly this case, and the user confirmed she casts those without preparing them.
- An **unprepared** spellbook ritual appears **nowhere**. That is her bug.

## Goals

- Every ritual she can act on is visible on `/encounter`.
- An unprepared spellbook ritual is visible there *and* preparable there, without a trip to
  `/spellbook`.
- No spell appears twice on the page.

## Non-goals

- **Moving prepared rituals out of Prepared Spells.** She said to add to what is there, not
  rearrange it. Consequence, stated so it is a known limitation rather than a surprise: a
  *prepared* ritual still shows only its slot-cast button, so ritual-casting it is not offered
  on this page. Worth revisiting; out of scope here.
- **Giving item-bound rituals a second home.** They already have a row.
- **Enforcing the 10-minute ritual cost.** The app has no clock and will not grow one here.
- **Changing `/spellbook`.** The "Needs preparing" section shipped there stays as is.

## Rules

2024 PHB: a spell with the **Ritual** tag can be cast as a ritual only if you **have it
prepared** — casting time +10 minutes, no slot spent. The Wizard's **Ritual Adept** is the
exception: a Wizard ritual-casts any ritual **in the spellbook**, prepared or not. Spells
granted by an item or lineage are never "prepared" in the first place, so preparation never
gates them.

This is the rule that produced her confusion twice today, and the section is shaped by it.

## The section

**Placement:** left column, after **Cantrips** — her choice. It also balances the grid, since
the right column (Innate + Prepared) is the tall one today.

**Filter behaviour:** rendered **only under the `All` filter** — her choice, and consistent
with how the page already treats things with no action-economy meaning. Ritualising is never
an Action, a Bonus Action or a Reaction, so under those filters the section disappears
entirely rather than lying about what it is.

**Contents — two groups.**

### 1. Castable now

Rituals she can ritual-cast this instant, from a new pure selector:

```ts
encounterRituals(c): Spell[]
```
= `availableRituals(c)` minus
- any name in `c.preparedSpells` — already on screen under **Prepared Spells**, and listing it
  twice on a dense page is worse than the gap it closes;
- any name in `itemBoundSpellNames(c)` — already on screen under **Abilities & Items** with its
  own cast button. This is the same exclusion `Innate Casting` already applies, for the same
  reason, and it is what keeps Brunella's two Ritual-Grimoire rows from doubling.

Per character that means:
- **Lyari (Wizard):** every spellbook ritual she has not prepared. Ritual Adept, so they are
  genuinely castable and genuinely missing from the page today.
- **Brunella (Bard):** normally empty — her rituals are either item-bound or prepared.

### 2. Needs preparing — **DECISION (mine)**

Below the first group, the non-Wizard's unprepared spellbook rituals — the existing
`ritualsNeedingPreparation(c)` selector, already shipped and tested for `/spellbook` — each
rendered with the **prepare star** and no cast affordance.

I added this rather than the strict reading of her answer ("only what can be cast directly"),
because without it **her own case still fails**: Brunella's new custom ritual is an unprepared
spellbook ritual, so group 1 does not contain it, and `/encounter` would still not show the
spell whose absence started this. The group is empty for Lyari and empty for anyone with
everything prepared, so it costs nothing when it is not needed.

It does **not** offer ritual-casting for those spells — the rule stands; the star is the fix,
and it is one tap.

## Rendering

`CompactSpellRow` is the row used by both neighbouring sections and is reused here, with two
additions:

- **`ritualMode`** — replaces the slot-cast control with a **Ritual** button, whose title states
  *"Ritual — casting time + 10 min, no slot"*. Following the Ritual-Grimoire decision (PR #23),
  the button exists **only where casting changes state the app tracks**: it takes concentration
  when the spell needs concentration, and otherwise there is **no button at all**, because a
  control that does nothing teaches her the app's buttons are unreliable.
- **`onPrepare`** — for group 2, renders the star (`togglePrepared`) instead.

`SubHeader icon="auto_stories" label="Rituals"` matches the existing section headers, and the
count follows the same `count={…}` convention.

## Behaviour when empty

Under `All`, the section renders only when it has something in either group — unlike
Abilities & Items and Cantrips, which keep an empty hint. A permanently empty "Rituals (0)"
on the page she uses most is noise, and for a character with no rituals at all it would never
go away.

## Testing

**Unit — `src/store/character.test.ts`** (extending, reusing `makeChar`), for the new
`encounterRituals`:
- a Wizard gets unprepared spellbook rituals and **not** the prepared ones;
- a Bard gets neither an unprepared spellbook ritual (that is group 2's job) nor a prepared one;
- innate rituals are included, **except** those named by a resource's `itemSpell` — the
  Ritual-Grimoire regression guard, since duplicating those rows is the most likely mistake;
- non-ritual spells never appear.

**Component, jsdom — `CompactSpellRow`** (new or extending): in `ritualMode`, a
concentration ritual renders an enabled Ritual button that takes concentration on click; a
non-concentration ritual renders **no** button; the star renders when `onPrepare` is given and
calls it with the spell name.

**Component, jsdom — the Encounter section** is *not* covered by a view test: this repo has no
view tests and rendering `<Encounter />` drags in `HpStrip`, `ConcentrationBar` and the icon
font. The selector carries the logic; the wiring is reviewed by eye and in the browser.

**Manual, headless Chrome** (`$TEMP/uitest/shootnav.mjs`, `#/encounter` — HashRouter):
- on **Brunella**, an unprepared custom ritual appears under **Needs preparing**, the star
  prepares it, and it then appears under **Prepared Spells** exactly once;
- her two Ritual-Grimoire rows still appear **once**, under Abilities & Items;
- on **Lyari**, unprepared spellbook rituals appear under **Rituals** with a Ritual button;
- switching the filter to **Action** hides the whole section.

Verify within a single browser session: on this machine Chrome does not reliably commit the
last `localStorage` write before it is killed, so cross-boot assertions are unreliable.

## Risks

- **Double-listing.** The single largest risk, and the reason both exclusions are in the
  selector rather than in the view, and the reason the item-bound case has its own test.
- **Density.** `/encounter` is her most-used and busiest page. Mitigated by `All`-only, by
  rendering nothing when empty, and by the compact row.
- **The prepared-ritual gap.** A prepared ritual still offers only a slot-cast on this page.
  Named in the non-goals; the fix is to move rituals out of Prepared Spells, which she declined.

## Open questions

None blocking. The two **DECISION (mine)** items above are the ones to sanity-check.
