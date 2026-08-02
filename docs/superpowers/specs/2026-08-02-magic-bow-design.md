# Design — Weapon attacks, and magic items that cast spells

Date: 2026-08-02
Status: approved inline by the user (brainstorm 2026-08-02), then **revised after an
adversarial spec review** — see "Revisions after review" at the end for what changed,
what was rejected, and why.

## Problem

Brunella acquired a magic bow: a **Longbow +2**, *enspelled* with **Ensnaring Strike**
(6 charges, regains 1d6 daily at dawn, requires attunement). Two things in the app have
no home for it.

1. **There is no concept of a weapon or a weapon attack anywhere in the codebase.** A
   grep over `src/` for `weapon|melee|toHit|damageRoll` returns zero matches. The app can
   tell you your spell attack bonus and save DC, and it can roll a d20 for a skill check,
   but it cannot tell you what you add when you shoot a bow. At the table that number is
   looked up on paper, which is exactly the kind of thing this app exists to stop.
2. **A magic item with charges cannot cast anything.** Items today are `Resource` entries:
   a `max`/`used` counter plus prose. The sample wizard's Wand of Magic Missiles is
   already modelled this way and is a bare counter — the "casts Magic Missile" part lives
   only in its description text. There is no link from a `Resource` to a `Spell`.

## Goals

- An **Attacks panel** on the Dashboard, sibling to the Armor Class panel, showing the
  attack bonus, damage, range and properties of each weapon, with the arithmetic broken
  down so a wrong number is visible rather than merely wrong.
- A magic item on the **Encounter** page that spends a charge to cast its bound spell,
  sets concentration, shows the spell text, and shows the save DC.
- A **dawn recharge** that rolls dice: tap ☀, enter your physical d6, charges rise to a
  cap. Charges are the thing that actually gets miscounted mid-session.
- Weapons and items are **authored as character data**, not hardcoded. Brunella's bow is
  the first instance of a general shape, not a special case in a component.

## Non-goals

- Rolling attacks for the user. The app is a companion for play with physical dice; the
  panel reports modifiers, it does not roll a d20. (Considered and declined during the
  brainstorm; the "type your d20, get the total" variant was offered and not chosen.)
- Ammunition tracking, weight, encumbrance, or an inventory system.
- Attunement slots and the 3-item limit.
- Weapon mastery properties (2024 PHB). The longbow's mastery is *Slow*, which Brunella
  cannot use — Bards get no Weapon Mastery.
- **Evaluating weapon properties for advantage/disadvantage.** 2024 `Heavy` gives a
  ranged weapon Disadvantage when Dexterity is below 13; Brunella's Dex is 17, so it
  never fires for her. `properties` is free text by design, and deriving mechanics from
  free text invites doing it for all fifteen properties. The panel displays properties
  and reasons about none of them.
- An in-app editor for weapons. They are authored in the character JSON, like spells.
- Syncing weapons across devices (see the decision below).
- Fixing the pre-existing gap that plain `dawn` resources reset fully on a long rest.
  Only *dice-recharge* resources change behaviour here.

## Rules research (D&D 2024)

Settled before design, per the project's "RAW first" rule, and independently re-verified
during spec review.

**Ensnaring Strike** — Level 1 Conjuration (**Ranger** spell). Casting Time: Bonus Action,
taken immediately after hitting a creature with a weapon. Range: Self. Components: V.
Duration: Concentration, up to 1 minute.

> As you hit the target, grasping vines appear on it, and it makes a Strength saving
> throw. A Large or larger creature has Advantage on this save. On a failed save, the
> target has the Restrained condition until the spell ends. On a successful save, the
> vines shrivel away, and the spell ends.
>
> While Restrained, the target takes 1d6 Piercing damage at the start of each of its
> turns. The target or a creature within reach of it can take an action to make a
> Strength (Athletics) check against your spell save DC. On a success, the spell ends.
>
> *Using a Higher-Level Spell Slot.* The damage increases by 1d6 for each spell slot
> level above 1.

The user's original request omitted the second paragraph. It is included in full: the
recurring 1d6 and the Athletics escape are the parts that come up in play.

That it is a **Ranger** spell matters structurally, not just as trivia: Brunella has no
legal way to cast it from a spell slot. The only route is the item's charges, and the UI
must not offer any other.

**Enspelled Weapon** (DMG 2024) — 6 charges, regains **1d6** expended charges daily at
dawn, requires attunement. Expend **1 charge** to cast the bound spell (one charge per
cast, not one per spell level). The bound spell must be Conjuration, Divination,
Evocation, Necromancy or Transmutation — Ensnaring Strike is Conjuration, so the item is
legal as authored. The bound spell's level sets the item's rarity, save DC and spell
attack bonus: level 1 gives Uncommon, **save DC 13**, spell attack bonus **+5**.

**Proficiency.** A longbow is a Martial Ranged weapon. The 2024 Bard is proficient with
Simple weapons only, and the 2024 Elf species grants no weapon proficiencies; College of
Lore adds none (only Valor does). The user confirmed Brunella is **not proficient**: her
proficiency bonus does not apply to this attack.

**Save DC, decided by the user.** RAW the item casts at DC 13; many tables rule that a
gifted item uses the wielder's DC (15 for Brunella: 8 + 3 proficiency + 4 Charisma). The
UI shows **both**, labelled, and the call is made at the table.

**Arithmetic.** Dex 15 + 2 (feat) = 17 → modifier +3. Attack = 3 + 0 (no proficiency) + 2
(magic) = **+5**. Damage = 1d8 + 3 + 2 = **1d8+5** Piercing.

> ⚠ Two unrelated `+5`s appear in this spec and are **coincidentally equal**. The item's
> *spell attack bonus* is +5 from the DMG table (and is unused — Ensnaring Strike has no
> attack roll). The *weapon attack bonus* is +5 from Dex and the magic bonus. Do not
> "reconcile" them; they move independently.

## Data model

### `Weapon` — new, `src/types/character.ts`

```ts
export interface Weapon {
  name: string;
  /** Which ability drives attack and damage. Ranged weapons use "dex". */
  ability: Ability;
  /** Whether the character's proficiency bonus applies. */
  proficient: boolean;
  /** A +N weapon: added to BOTH the attack roll and the damage. */
  magicBonus?: number;
  /** Damage dice as authored, e.g. "1d8". Never parsed — displayed and concatenated. */
  damageDice: string;
  /** e.g. "Piercing". */
  damageType: string;
  /** e.g. "150/600 ft". Free text. */
  range?: string;
  /** e.g. ["Ammunition", "Heavy", "Two-Handed"]. Displayed only, never interpreted. */
  properties?: string[];
  /** Free text shown under the weapon, e.g. the enspelled note. */
  note?: string;
}
```

No `id`. Nothing keys a weapon: the panel maps a read-only array, there is no store
action, no sync and no editor. React keys use `name + index`, the idiom already at
`ResourcesPanel.tsx:33`. Add an id when an editor exists and needs one.

`Character` gains `weapons?: Weapon[]`. **Optional and frequently `undefined`** — not
merely empty. `sampleWizard` has no `weapons` key, `importFightClubXml` builds a
`Character` literal without one, and every currently-persisted store predates the field.
Every read site uses `c.weapons ?? []`.

### `Resource` — two additive fields

```ts
export interface Resource {
  // …existing: id?, name, source?, desc?, max, used, recharge, actionType?, inspirePhraseDeck?

  /** Dice rolled to regain charges, e.g. "1d6". Only meaningful with recharge: "dawn". */
  rechargeDice?: string;

  /** The spell this item casts, with the item's own DC / attack bonus from the DMG table. */
  itemSpell?: {
    /** Resolved with findSpell(), so it may live in innateSpells or the spellbook. */
    name: string;
    saveDc?: number;
    attackBonus?: number;
  };
}
```

`itemSpell` is one nested object rather than three sibling fields precisely so the
invariant is structural: a DC that belongs to no spell cannot be expressed. It also
matches the shape of the DMG table, which binds DC *and* attack bonus together — the next
enspelled item the party finds may bind a spell that attacks rather than saves.

Both fields are optional and inert when absent, so no existing resource changes behaviour.

### Where the bound spell lives, and how it is kept out of the way

Ensnaring Strike is authored in `innateSpells` with `source: "item"` — already a legal
`SpellSource` — and **without** `freeCastsPerLongRest`. Its uses are the item's charges;
`racialFreeCastsUsed` is deliberately not involved.

**This placement has a trap that must be closed in the same change.** `Encounter.tsx:44`
renders *every* innate spell through `CompactSpellRow`, which computes castability from
spell slots:

```ts
const validLevels = SPELL_LEVELS.filter((lvl) => lvl >= spell.level && (c.spellSlotsMax[lvl] ?? 0) > 0);
const anyAvail = validLevels.some((lvl) => (c.spellSlots[lvl] ?? 0) > 0);
const canCast = freeLeft > 0 || anyAvail;
```

Brunella has slots at levels 1–3, so Ensnaring Strike would render an **enabled** Cast
button that spends a real Bard slot on a Ranger spell she cannot cast — and under the
*Bonus* action filter it would appear twice, once as the item and once as the innate row.

The Encounter innate list is therefore filtered by the set of item-bound spell names:

```ts
const itemSpellNames = new Set(
  c.resources.flatMap((r) => (r.itemSpell ? [r.itemSpell.name] : [])),
);
const innate = c.innateSpells
  .filter((s) => !itemSpellNames.has(s.name))
  .filter((s) => castingTimeMatchesFilter(filter, s.castingTime));
```

The spell stays in `innateSpells` so `findSpell` and `ConcentrationBar` keep working
unchanged; it simply has exactly one place to be cast from. A test asserts Ensnaring
Strike renders exactly once on the Encounter page.

### Brunella's data

```jsonc
"weapons": [{
  "name": "Longbow +2",
  "ability": "dex",
  "proficient": false,
  "magicBonus": 2,
  "damageDice": "1d8",
  "damageType": "Piercing",
  "range": "150/600 ft",
  "properties": ["Ammunition", "Heavy", "Two-Handed"],
  "note": "Enspelled with Ensnaring Strike. Requires attunement."
}]
```

The resource:

```jsonc
{
  "name": "Longbow +2 — Charges",
  "source": "Magic item",
  "desc": "Enspelled Longbow +2. Expend 1 charge to cast Ensnaring Strike…",
  "max": 6, "used": 0,
  "recharge": "dawn", "rechargeDice": "1d6",
  "actionType": "bonus",
  "itemSpell": { "name": "Ensnaring Strike", "saveDc": 13, "attackBonus": 5 }
}
```

`actionType: "bonus"` is correct and load-bearing: Ensnaring Strike is cast as a Bonus
Action, so the Encounter action filter files the item under *Bonus*.

### Persistence and sync

- **No persist version bump.** `weapons` is a purely additive optional field with a
  read-side `?? []` default; a v5 state loaded by the new code is already correct, so a
  v6 migration would have no payload. `CLAUDE.md`'s rule exists to stop users having to
  re-import when a shape change would otherwise lose data, and nothing here can lose
  data. `loadCharacter` still gains a `weapons: c.weapons ?? []` backfill alongside the
  ones it already does for `innateSpells`, `racialFreeCastsUsed` and `hitDice`.
- **Weapons are NOT added to `DurableSheet`.** They are authored in the character JSON,
  which is byte-identical on every device, so syncing them would add shape-drift hazard
  for no gain. This is verified safe, not merely assumed: `applyDurable`
  (`durableSheet.ts:47-64`) spreads `...c` and overwrites only its seven named fields, so
  a cloud pull cannot wipe `weapons`; and `payloadFor`/`digestState` in `store/sync.ts`
  hash only `{sheet, coin}`, so weapons can never make a device read as dirty. Charges
  used are session state and stay excluded for the reason `durableSheet.ts:9-12` gives.

## Behaviour

### Attacks panel — Dashboard

New `src/components/panels/AttacksPanel.tsx`, rendered in `Dashboard.tsx` directly after
`<AcPanel />` in the left `md:col-span-4` column. It uses AcPanel's chrome
(`bg-surface-container border border-outline-variant/30 rounded-xl p-md relative
overflow-hidden`, the `leather-noise` layer, `font-serif text-title-sm text-primary`
heading).

`fmt` (`AcPanel.tsx:10-12`) and `BreakdownRow` (`AcPanel.tsx:75-97`) are module-local
today. They move to `src/components/ui/BreakdownRow.tsx` and both panels import them —
signed-number formatting is exactly what the attack bonus needs, and a copy would drift.

Per weapon: a round badge with the signed attack bonus, the name, `1d8+5 Piercing`, the
range, the properties, the optional note, and a breakdown listing ability modifier,
proficiency and magic bonus. When `proficient` is false the proficiency row is still
rendered, as `—` with the hint `not proficient`, because a silently missing row looks the
same as a bug.

The panel returns `null` when `(c.weapons ?? []).length === 0`, so every other character
is unaffected.

### Maths — `src/lib/weapons.ts` (new, pure, TDD)

```ts
weaponAttackBonus(c, w) = abilityMod(abilityScore(c, w.ability))
                        + (w.proficient ? c.proficiencyBonus : 0)
                        + (w.magicBonus ?? 0)

weaponDamageBonus(c, w) = abilityMod(abilityScore(c, w.ability)) + (w.magicBonus ?? 0)
weaponDamageLabel(c, w) = `${w.damageDice}${bonus ? fmt(bonus) : ""} ${w.damageType}`
```

A zero damage bonus renders `1d8 Piercing`, not `1d8+0 Piercing`; a negative bonus renders
`1d8-1 Piercing`. `abilityScore` (`abilities.ts:34`) already sums base + feat + magic, so
Brunella's Dex 15+2 is counted without special handling.

### Item casting — Encounter

`CompactResourceRow` gains, when `itemSpell` is set and `findSpell(c, itemSpell.name)`
resolves — `findSpell` (`character.ts:494`) searches the spellbook *and* innate spells,
which is the same lookup `ConcentrationBar` uses, so the two can never disagree:

- a **Cast** button, disabled at 0 remaining charges, which spends one charge via the
  existing `useResource(name)` and, because the spell has `concentration: true`, calls
  `setConcentration(spellName, level)`. The existing `ConcentrationBar` then shows it.
- **A concentration warning.** `setConcentration` overwrites unconditionally
  (`character.ts:216-219`). When `c.concentration` is set to a *different* spell, the row
  shows `Replaces Faerie Fire` next to the button and the button's `title` says so. This
  is the item feature's most likely mid-session mistake — Brunella is usually already
  concentrating on something.
- the DC line `DC 13 (item) · DC 15 (yours)`, from `itemSpell.saveDc` and `spellSaveDc(c)`.
  With no `saveDc` only the character's own DC is shown.
- an expandable spell description, matching how `CompactSpellRow` reveals text.

Casting from the item never touches spell slots — the charge is the whole cost. When
`itemSpell.name` dangles (no such spell), the row degrades to a plain counter: no Cast
button, no DC line, no crash.

### Dawn recharge

A shared `src/components/DawnRecharge.tsx`, used by both `CompactResourceRow` (Encounter)
and `ResourceCard` (Dashboard) so the control is identical in both. Rendered only when
`rechargeDice` is set.

A ☀ button opens a small inline input: *"Roll 1d6 and enter the result."* Entering `n`
calls the **existing** `refundResource(name, n)` (`character.ts:275-283`), which already
does `used = max(0, used - count)` and therefore caps at full. No new store action: an
identical second mutation would be two code paths to keep in sync forever.

The legal range comes from parsing `^(\d+)d(\d+)$` into `{count, sides}` and clamping to
`count … count*sides` — for `2d6` that is 2..12, which a "right-hand side" rule would get
wrong. A string that does not match the pattern is not clamped at the top, only at `>= 1`,
matching the hit-dice input's posture (`RestMenu.tsx:57-62`). Zero, negative, decimal,
empty and non-numeric input are all no-ops. The button label previews the outcome as you
type, as the hit-dice input does.

The recharge badge reads `Dawn 1d6` rather than `Dawn` when `rechargeDice` is set, in both
`RECHARGE_LABEL` renderers.

### Long rest

`longRest` (`character.ts:369-373`) currently zeroes every resource whose recharge is
`long`, `short` or `dawn`. It gains one guard, scoped to **both** conditions:

```ts
r.recharge === "dawn" && r.rechargeDice   // → left untouched
```

Keying on `rechargeDice` alone would break a future `recharge: "long", rechargeDice: "1d4"`
resource, which by its own declaration *should* refill on a long rest. Plain `dawn`
resources without dice — the sample wizard's wand — keep today's behaviour. `shortRest`
(`character.ts:396-404`) only touches `recharge === "short"` and needs no change.

`RestMenu.tsx:80` currently promises a long rest will "reset daily resources". That
sentence becomes false for dice-recharge items, so it is amended to name the exception.
Rest behaviour that silently stops working is a failure mode this project has already
been burned by.

## Testing

**Unit — `src/lib/weapons.test.ts`:** proficient and non-proficient attack bonus; magic
bonus present and absent; damage label for positive, zero and negative bonuses; and that
a feat ability bonus (Dex 15+2) is counted.

**Unit — store:** `refundResource` clamps at 0 used and ignores overshoot (coverage this
action never had); `longRest` leaves a `dawn` + `rechargeDice` resource untouched while
still clearing a plain `dawn` one.

**Unit — dice parsing:** `1d6` → 1..6, `2d6` → 2..12, `d6` and `garbage` → no upper clamp.

**Data — `src/lib/characterData.test.ts`:** import each JSON under `public/characters/`
directly (Vite resolves JSON imports) and assert (a) `weaponAttackBonus` on Brunella's
real record is `+5`, so a typo in the JSON fails a test rather than reaching the table,
and (b) `new Set(resources.map(r => r.name)).size === resources.length`, because every
store action keys resources by `name` and the bow adds `"Longbow +2 — Charges"` one
em-dash away from the weapon's `"Longbow +2"`.

**Component — jsdom** (per-file `// @vitest-environment jsdom`, explicit `afterEach(cleanup)`
since vitest globals are off, following `HeaderStatus.test.tsx`): AttacksPanel renders
`+5` and `1d8+5 Piercing`, and returns null for both `weapons: []` and `weapons: undefined`;
the item row disables Cast at 0 charges, spends exactly one charge on click, shows the
replacement warning when concentrating on another spell, and degrades to a plain counter
when `itemSpell.name` dangles; Ensnaring Strike appears exactly once on the Encounter page.

**Manual — headless Chrome over CDP** against the dev server, because jsdom is not the
browser: load Brunella, confirm the Dashboard panel, cast from the Encounter item, see
concentration appear, run a dawn recharge.

## Chore included in this change

`vite.config.ts:148` sets `port: 5173`, but `CLAUDE.md` documents **5180** as this
project's port because 5173 collides with another app on this machine, and `npm run dev`
is a bare `vite` that passes no override. The config is corrected to `5180` so the
documented port is the real one.

## Risks

- **`Resource` is keyed by `name`, not `id`,** throughout the store, even though
  `Resource.id` exists and is used for React keys. Two resources sharing a name both
  mutate. Mitigated by the uniqueness test above, not by a refactor.
- **`itemSpell.name` is a string reference** that dangles if the spell is renamed. The row
  degrades to a plain counter, and a test covers it.
- **Reloading Brunella from the library destroys running session state.** `loadCharacter`
  replaces the character wholesale: current HP back to full, every spell slot restored,
  every `resources[].used` reset to 0, concentration cleared. This is the only way the bow
  reaches her devices, since none of it syncs. **Do the reload before a session, never
  mid-session.** It is the same reload Astral Flood already needs, so both arrive together
  if this ships first.

## Revisions after review

An adversarial subagent reviewed the committed spec against the code and re-verified the
rules independently. It confirmed the D&D research, the Dashboard layout, the AcPanel
chrome, the `abilityScore`/`setConcentration` signatures, the `SpellSource` `"item"` value
and the vitest-globals-off claim. It found the following, all applied:

1. **Blocker — a second, slot-burning Cast button.** Innate spells are all rendered on
   Encounter; Ensnaring Strike would have offered a slot cast of a Ranger spell, twice
   under the Bonus filter. Now filtered out of the innate list.
2. **Blocker — the proposed `rechargeResource` already exists as `refundResource`.**
   Dropped; the existing action is used and finally gets a test.
3. **Blocker — the long-rest guard was scoped to `rechargeDice` alone**, which would have
   broken a future `recharge: "long"` dice resource, and it left the RestMenu copy lying.
   Now scoped to `dawn && rechargeDice`, with the copy amended.
4. `itemSaveDc` became the nested `itemSpell` object, so a DC cannot exist without a spell
   and the DMG table's attack bonus has somewhere to live.
5. The dice clamp now parses `NdM` properly — `2d6` is 2..12, not 1..6.
6. `grantsSpell` resolution moved to the existing `findSpell`, which searches both books,
   so the row and `ConcentrationBar` cannot disagree.
7. `weapons` is treated as `undefined`, not `[]`: `sampleWizard` and the XML importer
   never set it.
8. The persist v5→v6 bump was dropped as a no-op, with the reasoning recorded.
9. Concentration clobbering is now surfaced in the UI instead of being silent.
10. `fmt`/`BreakdownRow` are extracted rather than copied; `Weapon.id` dropped as YAGNI.
11. The reload's true cost (session state destroyed) is stated plainly in Risks.
12. A data test over `public/characters/*.json` guards resource-name uniqueness and the
    real attack arithmetic.

**One finding rejected.** The reviewer proposed evaluating the `Heavy` property to warn
about Disadvantage below Dex 13. Declined and promoted to an explicit non-goal:
`properties` is free text, Brunella's Dex 17 never triggers it, and deriving one
property's mechanics from a display string sets a precedent for the other fourteen.

## Open questions

None. Proficiency (not proficient), save DC (show both), recharge (own dawn button) and
panel scope (numbers only) were settled in the brainstorm.
