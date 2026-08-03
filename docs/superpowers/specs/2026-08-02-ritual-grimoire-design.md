# Design — The Ritual-Grimoire: items that grant spells with no charges

Date: 2026-08-02
Status: approved inline by the user (brainstorm 2026-08-02), then **revised after an
adversarial spec review** — see "Revisions after review" at the end.

## Problem

Brunella received a **Ritual-Grimoire**: an item holding two level 1 ritual spells,
**Wild Cunning** and **Guiding Hand**, which she can cast in ritual mode from the book.

The item model built for the Enspelled Longbow (PR #21) does not fit. It assumes an item
spends a **charge** to cast **one** spell: `Resource.itemSpell` is singular, and
`CompactResourceRow` only renders its cast affordance inside the `isCounter`
(`max > 0`) branch. The grimoire has **no charges** and **two** spells.

## Goals

- Both rituals visible in **Abilities & Items**, on their own rows, each naming
  **Ritual-Grimoire** as its source.
- Casting **Guiding Hand** takes concentration. Not because the app models an 8-hour
  duration — `ConcentrationState.rounds` counts *combat rounds*, and 8 hours is 4,800 of
  them, so the counter is meaningless here and that is accepted. It takes concentration
  because concentration is **mutually exclusive**, and knowing that Guiding Hand is the
  thing currently occupying it is the fact worth recording.
- Both spells' full text available in the row, so the table does not need a second screen.
- No duplicate entry anywhere else in the app — and, conversely, the rituals **do** appear
  on the page named for rituals.

## Non-goals

- Charges, uses per day, or attunement for the grimoire. The user confirmed unlimited use.
- Enforcing the ritual time cost. Rituals add 10 minutes; the app has no clock and will
  not grow one here. The row states the cost; the player counts it.
- A cast button for Wild Cunning (see the decision below).
- Casting from the Dashboard. The Enspelled Longbow already casts only from Encounter, and
  this keeps parity rather than inventing a second pattern.

## Rules research

Both spells come from **Unearthed Arcana 36: Starter Spells (2017)**. They are **playtest
material and were never published in a Player's Handbook**, 2014 or 2024. The user knows;
her DM granted the item and she will confirm with him. Recorded in the spell text itself
so nobody later mistakes them for official content.

Verified against two independent sources (dnd5e.wikidot.com and wiki.rlyehable.com), which
agree on every field — including Guiding Hand's casting time, where one search summary had
claimed "1 bonus action".

**Wild Cunning** — 1st-level Transmutation (ritual). Casting Time: 1 action. Range: 120
feet. Components: V, S. Duration: Instantaneous. Druid, Ranger.

> You invoke nature spirits for aid, choosing one effect: advantage on tracking within
> range for 1 hour; locate edible forage; find clean drinking water; identify suitable
> shelter; have the spirits construct a campsite with fire, tents, bedrolls and supplies;
> or have them dismantle a campsite, extinguishing the fire, striking the tents, packing
> up and burying the waste.

**Guiding Hand** — 1st-level Divination (ritual). Casting Time: 1 minute. Range: 5 feet.
Components: V, S. **Duration: Concentration, up to 8 hours.** Bard, Cleric, Druid, Wizard.

> You manifest a tiny luminous hand in an empty space within range. After you name a
> landmark on the same plane that appears on a historical map, the hand guides you toward
> it. When you move toward the hand, it retreats 5 feet ahead in the landmark's direction.
> If you stay still, it beckons you every 1d4 minutes.

Ritual casting in 2024 costs the spell's casting time **plus 10 minutes**, **no spell
slot**, and RAW requires the spell to be **prepared**. The grimoire is a DM-granted
exception to that preparation requirement — recorded here so nobody later "fixes" it.

**Why the item route rather than the spellbook**, per spell:

- **Wild Cunning** is Druid/Ranger. It is off the Bard list entirely; there is no legitimate
  way for Brunella to have it, so it can only come from an item.
- **Guiding Hand** *is* on the Bard list. It is simply not in her spellbook, and ritual
  casting would require preparing it. Putting it in the spellbook instead would mean
  spending a prepared-spell slot on it, which is precisely what the grimoire exists to
  avoid — and it would misrepresent where it came from if the DM ever takes the book away.

Both therefore live with the item.

## Decision: no cast button for Wild Cunning

The ⚡ exists to change state the app tracks — spend a charge, take concentration. Wild
Cunning is instantaneous, chargeless and non-concentration, so its button would do
nothing. A control that does nothing is worse than no control: it invites a click and then
teaches the user that the app's buttons are unreliable.

So the bolt appears when casting actually changes tracked state:

| | charges? | concentration? | bolt |
|---|---|---|---|
| Longbow +2 — Charges | yes | yes | spends 1 charge, takes concentration |
| Guiding Hand | no | yes | takes concentration |
| Wild Cunning | no | no | **none** — reference row only |

Stated to the user during the brainstorm, who was told to push back if she wants the bolt
on both anyway.

## Data model

### `Resource` — one field generalised, none added

`max: 0` already means "passive, no counter" and is rendered as such. That is exactly what
a chargeless item spell is, so **no new field is needed** to express "unlimited". The work
is in the row, not the type.

The only type change is a comment correction: `itemSpell` currently reads as though it
implies a charge cost. It does not.

### The two rows

```jsonc
{
  "name": "Wild Cunning",
  "source": "Ritual-Grimoire",
  "desc": "Ritual only: casting time + 10 minutes, no spell slot. …",
  "max": 0, "used": 0,
  "recharge": "manual",
  "itemSpell": { "name": "Wild Cunning" }
},
{
  "name": "Guiding Hand",
  "source": "Ritual-Grimoire",
  "desc": "Ritual only: casting time + 10 minutes, no spell slot. …",
  "max": 0, "used": 0,
  "recharge": "manual",
  "itemSpell": { "name": "Guiding Hand" }
}
```

No `saveDc` or `attackBonus`: neither spell has a save or an attack roll.

`actionType` is **omitted deliberately**. A 10-minute ritual has no place in the action
economy, and omitting it means the Encounter filters show these rows only under *All* —
which is correct. `actionTypeMatchesFilter` already handles an absent `actionType` this way.

### The spells

Added to `innateSpells` with `ritual: true` and `source: "item"`, carrying the full UA
text. The existing `itemSpellNames` filter in `Encounter.tsx` (added in PR #21) already
keeps any spell named by a resource's `itemSpell` out of the Innate Casting list, so both
are automatically excluded from that list and appear exactly once. **This is asserted by a
test rather than assumed.**

### Resource names collide with spell names — on purpose, and safely

The resource is named `"Wild Cunning"` and so is the spell. Store actions key resources by
`name`, and `findSpell` keys spells by name; the two namespaces never meet, so there is no
collision. The existing uniqueness test in `characterData.test.ts` covers resource names
among themselves, which is the case that actually matters.

## Behaviour

### `CompactResourceRow`

Today the cast affordance lives inside the `isCounter` (`max > 0`) branch. It moves out so a
chargeless item spell can cast too.

**Every site currently keyed on `remaining` must move to `castable`.** This is the whole
substance of the change, and getting it half-right ships a bolt that renders greyed out,
says *"Depleted"*, and does nothing — the exact failure the no-bolt-for-Wild-Cunning
decision exists to prevent. For a chargeless row `remaining` is `0 - 0 = 0`, so every
`remaining <= 0` test is true.

```ts
const chargeless = resource.max === 0;
const castable = Boolean(itemSpell) && (chargeless || remaining > 0);
// The bolt only exists where casting changes tracked state.
const showsBolt = Boolean(itemSpell) && (itemSpell.concentration || !chargeless);
```

The four sites, named explicitly:

| site | today | becomes |
|---|---|---|
| `castFromItem` early return | `if (!itemSpell \|\| remaining <= 0) return;` | `if (!castable) return;` |
| `disabled` | `remaining <= 0` | `!castable` |
| className ternary | `remaining > 0 ? …` | `castable ? …` |
| `title` | `remaining <= 0 ? "Depleted" : …` | `!castable ? "Depleted" : …`, and *"Depleted"* is only reachable when `!chargeless` |

Also:

- The **accessible name drops the charge claim when there is none**:
  `chargeless ? \`Cast ${name}\` : \`Cast ${name} — spends 1 charge\``. It is what screen
  readers announce and what the tests match on, so a false "spends 1 charge" is not cosmetic.
- **The `replaces` concentration warning moves with the bolt.** It currently renders inside
  the `isCounter` branch; leaving it there would give Guiding Hand a bolt that silently
  clobbers concentration, regressing the fix made in PR #22 — on the spell most likely to
  trigger it, since it holds concentration for eight hours. The chip renders wherever the
  bolt renders, collapsed row included.
- `castFromItem` skips `useResource` when `chargeless`. This is for legibility only:
  `useResource` does `Math.min(r.max, r.used + count)`, which is already a no-op at
  `max: 0`. The spec does **not** claim a test covers the skip, because no black-box test
  can distinguish it.
- The `passive` label is suppressed based on the **resolved** spell, not the authored
  `resource.itemSpell`. Keying it on the raw field would leave a dangling chargeless
  reference with no counter, no bolt, no chip and no label — a completely empty row, which
  is the "looks like a rendering bug" outcome the Risks section warns about. A dangling
  chargeless row degrades to `passive`, like any other feature with nothing to track.
- **The DC line is suppressed entirely when no item DC is authored.** Today only the
  `(item)` half is conditional and `DC {spellSaveDc(c)} (yours)` always renders, so
  expanding Guiding Hand — a spell with no saving throw — would read `DC 15 (yours)`. The
  whole paragraph now renders only when `resource.itemSpell?.saveDc !== undefined`.

### The ritual marker

The recharge badge is **not** touched. An `R` in the slot that otherwise holds `LR`, `SR`,
`Dawn` and `☀` reads as a third rest abbreviation, and it would have to fight the bow's `☀`
for precedence and be scoped so a future `recharge: "long"` ritual item does not lose its
real label.

Instead a small **`Ritual`** chip sits next to the name in both renderers, shown when the
row's resolved spell has `ritual: true`, with the title *"Ritual — casting time + 10 min,
no spell slot"*. `ResourcesPanel` already renders chips next to the name, so on the
Dashboard it joins the existing `source` chip; `CompactResourceRow` gets the same tag in its
denser style.

### The Ritual Archive must list them

`availableRituals`, `preparedRituals` and `unpreparedRituals` (`store/character.ts:515-538`)
read `c.spellbook` only — `innateSpells` is never consulted. So an item called
**Ritual-Grimoire** would have its rituals absent from the page called **Ritual Archive**,
which is the first place a player looks. The same gap already hides Brunella's High Elf
Detect Magic, which is authored `ritual: true` in `innateSpells` and appears nowhere in that
tab today.

`availableRituals` gains the innate rituals:

```ts
export function availableRituals(c: Character): Spell[] {
  const fromBook = c.spellbook.filter((s) => s.ritual);
  const book =
    c.className.trim().toLowerCase() === "wizard"
      ? fromBook
      : fromBook.filter((s) => c.preparedSpells.includes(s.name));
  // Innate rituals — lineage, feat, item — are always available: there is no
  // preparation step for a spell you did not prepare in the first place.
  return [...book, ...c.innateSpells.filter((s) => s.ritual)];
}
```

This is a deliberate, small scope addition rather than an accepted non-goal: it is one
function, it makes the feature coherent with the page named for it, and it fixes a
pre-existing hole in the same stroke.

### Everything else

`ResourcesPanel` (Dashboard) already renders `source` as a chip and `desc` in the details,
so both rows appear there as reference entries with **Ritual-Grimoire** and the new `Ritual`
chip, and no cast button — the same shape the Enspelled Longbow already has on that page.

**Known limitation, stated rather than fixed:** the `replaces` warning only fires when
casting *from an item*. Casting Faerie Fire from the spell list will still silently drop
Guiding Hand, because `setConcentration` overwrites unconditionally from every call site.
Fixing that properly means touching every casting path and belongs in its own change.

## Testing

**Component, jsdom** (`CompactResourceRow.test.tsx`, extending the existing file):
- a chargeless concentration spell (Guiding Hand) renders a bolt that is **enabled**, whose
  accessible name does **not** promise a charge, and clicking it takes concentration;
- that same bolt shows the `drops X` warning **with the row collapsed** when concentrating
  on something else — the regression guard for PR #22's fix;
- a chargeless non-concentration spell (Wild Cunning) renders **no** bolt and no counter;
- neither row shows the `passive` label, but a **dangling** chargeless reference does;
- expanding a row with no authored `saveDc` shows **no** DC line at all;
- the `Ritual` chip renders for a ritual spell and not otherwise.

**Unit** (`src/lib/itemSpells.ts`, new): the Encounter view's exclusion set is extracted to a
pure `itemBoundSpellNames(c): Set<string>` and unit-tested — collects every resource's
`itemSpell.name`, ignores resources without one, tolerates an empty resource list. Rendering
the whole `<Encounter />` in jsdom to assert the same thing would drag in `HpStrip`,
`ConcentrationBar`, `CompactSpellRow` and the Material Symbols icon font for one boolean;
extracting the predicate is cheaper and better factored. The end-to-end "appears exactly
once" claim stays a browser check.

**Unit** (`src/store/character.test.ts`, extending): `availableRituals` returns innate
rituals for a non-Wizard, still filters spellbook rituals by preparation, and still returns
every spellbook ritual for a Wizard.

**Data** (`characterData.test.ts`, extending): every `itemSpell` still resolves — already
covered generically, so the two new rows are picked up for free — plus an assertion that
Brunella has one resource per Ritual-Grimoire spell and that both carry `ritual: true`.

**Manual, headless Chrome** via `$TEMP/uitest/shoot.mjs`: both rows present under Abilities
& Items with the Ritual-Grimoire source, Guiding Hand's bolt takes concentration, Wild
Cunning has no bolt, and a screenshot to check the rows do not look broken next to the
counter rows.

## Risks

- **A row with no controls at all** (Wild Cunning collapsed) could read as a rendering bug.
  Mitigated by the `R` badge and the chevron, which show it is a real, expandable entry.
- **Non-canon content on the sheet.** Recorded in the spell text; the user is talking to her
  DM. If he rules differently the fix is a JSON edit, not code.
- **The reload cost again.** As with the bow, none of this syncs: it reaches her devices
  only by reloading Brunella from the library, which resets current HP, slots, resource
  charges and concentration. Before a session, never mid-session.

## Revisions after review

An adversarial subagent reviewed the committed spec against the code and re-verified the
rules. It confirmed that `max: 0` renders as passive, that an absent `actionType` shows a
resource only under *All*, that the `itemSpellNames` filter works as described (and applies
before the action filter, so the exclusion holds under every filter), that resource-name and
spell-name namespaces genuinely never meet, and every rules claim except one. Applied:

1. **Blocker — the chargeless bolt was inert as specified.** `remaining` is `0` on a
   chargeless row, so `castFromItem`'s early return, `disabled`, the className ternary and
   the `title` would all have treated Guiding Hand as depleted. The spec introduced
   `castable` and then never used it. All four sites are now named individually.
2. **Blocker — the `replaces` warning lives inside the `isCounter` branch.** Moving the bolt
   out without it would have regressed PR #22's fix on the spell most likely to need it.
3. **Blocker — a factual contradiction.** The spec listed Bard among Guiding Hand's classes
   and then claimed "neither spell is on the Bard list" as the item's whole justification.
   Guiding Hand *is* a Bard spell; the real reasons are per-spell and now written out.
4. A dangling chargeless reference would have rendered a completely empty row; the `passive`
   suppression now keys on the resolved spell.
5. `DC {spellSaveDc(c)} (yours)` renders unconditionally today, so Guiding Hand — which has
   no saving throw — would have advertised one. The DC line is now all-or-nothing.
6. **The Ritual Archive lists nothing from items or lineage.** An item called
   Ritual-Grimoire whose rituals are missing from that page is indefensible, and the same
   gap already hides Detect Magic. `availableRituals` now unions the innate rituals.
7. The `R` badge idea was **rejected** and replaced by a `Ritual` chip beside the name: `R`
   next to `LR`/`SR` reads as a rest abbreviation, and it would have had to fight `☀` for
   the slot and be scoped against future non-manual ritual items.
8. The bolt's accessible name no longer promises "spends 1 charge" when there are no charges.
9. Goal #2's justification was wrong about what the app tracks — `rounds` counts combat
   rounds, useless for 8 hours. Rewritten to the real reason, mutual exclusion.
10. The proposed `<Encounter />` jsdom test is replaced by extracting `itemBoundSpellNames`
    to a pure, unit-tested helper. There are no view tests in this repo today, and rendering
    that view for one boolean is not worth the new infrastructure.
11. Noted as a known limitation rather than fixed: casting from the *spell list* still drops
    concentration silently. Fixing it touches every casting path.

## Open questions

None. Format (two rows), unlimited use, and the no-bolt-for-Wild-Cunning consequence were
settled in the brainstorm; everything above is a correctness fix to how they get built.
