# Design — The Ritual-Grimoire: items that grant spells with no charges

Date: 2026-08-02
Status: approved inline by the user (brainstorm 2026-08-02). Pending adversarial spec review.

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
- Casting **Guiding Hand** takes concentration, because it concentrates for up to 8 hours
  and the app already tracks exactly that.
- Both spells' full text available in the row, so the table does not need a second screen.
- No duplicate entry anywhere else in the app.

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

Ritual casting in 2024 costs the spell's casting time **plus 10 minutes** and **no spell
slot**. Neither spell is on the Bard list, which is the point of the item: without it
Brunella cannot cast either at all.

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

Today the cast affordance lives inside the `isCounter` (`max > 0`) branch. It moves out, so
a chargeless item spell can cast too:

- `const chargeless = resource.max === 0;`
- `const castable = Boolean(itemSpell) && (chargeless || remaining > 0);`
- The bolt renders when `itemSpell` **and** casting would change state — i.e.
  `itemSpell.concentration || !chargeless`. Wild Cunning satisfies neither and gets no bolt.
- `castFromItem` skips `useResource` when `chargeless`; there is nothing to spend.
- A chargeless row keeps showing no counter, no undo and no dawn control, exactly as a
  passive resource does today.

The recharge badge, which would read `—` for these, is replaced by **`R`** when the row's
spell is a ritual, with the tooltip *"Ritual — casting time + 10 min, no spell slot"*. The
badge slot is otherwise wasted on a resource that never recharges.

The word `passive` is suppressed when the row carries an `itemSpell`: these are not passive
features, they are castable spells that simply have no counter.

### Everything else

`ResourcesPanel` (Dashboard) already renders `source` as a chip and `desc` in the details,
so both rows appear there as reference entries with **Ritual-Grimoire** on them and no cast
button — the same shape the Enspelled Longbow already has on that page.

## Testing

**Component, jsdom** (`CompactResourceRow.test.tsx`, extending the existing file):
- a chargeless concentration spell (Guiding Hand) renders a bolt, and clicking it takes
  concentration **without** changing `used`;
- a chargeless non-concentration spell (Wild Cunning) renders **no** bolt and no counter;
- neither row shows the `passive` label;
- the ritual badge reads `R`.

**Data** (`characterData.test.ts`, extending): every `itemSpell` still resolves — already
covered generically, so the two new rows are picked up for free — plus an assertion that
Brunella has exactly one resource per Ritual-Grimoire spell and that both spells carry
`ritual: true`.

**View** (`Encounter.tsx`): a test that Wild Cunning and Guiding Hand each appear exactly
once on the Encounter page, i.e. the innate-list filter really does exclude them. The bow's
equivalent was verified only in the browser; this makes it a unit test for all three.

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

## Open questions

None. Format (two rows), unlimited use, and the no-bolt-for-Wild-Cunning consequence were
all settled in the brainstorm.
