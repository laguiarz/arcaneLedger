# Design — Weapon attacks, and magic items that cast spells

Date: 2026-08-02
Status: approved inline by the user (brainstorm 2026-08-02). Pending adversarial spec review.

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
- An in-app editor for weapons. They are authored in the character JSON, like spells.
- Syncing weapons across devices (see the decision below).
- Fixing the pre-existing gap that plain `dawn` resources reset fully on a long rest.
  Only *dice-recharge* resources change behaviour here.

## Rules research (D&D 2024)

Settled before design, per the project's "RAW first" rule.

**Ensnaring Strike** — Level 1 Conjuration. Casting Time: Bonus Action, taken immediately
after hitting a creature with a weapon. Range: Self. Components: V. Duration:
Concentration, up to 1 minute.

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

The user's original spec omitted the second paragraph. It is included in full: the
recurring 1d6 and the Athletics escape are the parts that come up in play.

**Enspelled Weapon** (DMG 2024) — 6 charges, regains **1d6** expended charges daily at
dawn, requires attunement. Expend **1 charge** to cast the bound spell (one charge per
cast, not one per spell level). The bound spell's level sets the item's rarity, save DC
and attack bonus: a level 1 spell gives Uncommon, **save DC 13**, attack bonus +5.

**Proficiency.** A longbow is a Martial weapon. The 2024 Bard is proficient with Simple
weapons only, and the 2024 Elf species grants no weapon proficiencies. The user confirmed
Brunella is **not proficient**: her proficiency bonus does not apply to this attack.

**Save DC, decided by the user.** RAW the item casts at DC 13; many tables rule that a
gifted item uses the wielder's DC (15 for Brunella: 8 + 3 proficiency + 4 Charisma). The
UI shows **both**, labelled, and the call is made at the table.

## Data model

### `Weapon` — new, `src/types/character.ts`

```ts
export interface Weapon {
  /** Stable id. Optional so hand-authored JSON can omit it; falls back to name. */
  id?: string;
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
  /** e.g. ["Ammunition", "Heavy", "Two-Handed"]. */
  properties?: string[];
  /** Free text shown under the weapon, e.g. the enspelled note. */
  note?: string;
}
```

`Character` gains `weapons?: Weapon[]`. Optional, defaulting to `[]`, so every existing
character JSON and every persisted store stays valid.

### `Resource` — two additive fields

```ts
export interface Resource {
  // …existing: id?, name, source?, desc?, max, used, recharge, actionType?, inspirePhraseDeck?

  /** Dice rolled to regain charges, e.g. "1d6". Recharge is manual + capped at `max`. */
  rechargeDice?: string;
  /** Name of a spell this item casts. Must match a spell in `innateSpells`. */
  grantsSpell?: string;
  /** The item's own spell save DC, shown next to the character's own. */
  itemSaveDc?: number;
}
```

Both are optional and inert when absent, so no existing resource changes behaviour.

### The bound spell

Ensnaring Strike is authored in `innateSpells` with `source: "item"` — already a legal
`SpellSource` value — and **without** `freeCastsPerLongRest`. Its uses are the item's
charges, tracked on the `Resource`; `racialFreeCastsUsed` is deliberately not involved.

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

Attack `+5` (Dex +3, no proficiency, magic +2); damage `1d8+5` Piercing.

The resource:

```jsonc
{
  "name": "Longbow +2 — Charges",
  "source": "Magic item",
  "desc": "Enspelled Longbow +2. Expend 1 charge to cast Ensnaring Strike…",
  "max": 6, "used": 0,
  "recharge": "dawn", "rechargeDice": "1d6",
  "actionType": "bonus",
  "grantsSpell": "Ensnaring Strike",
  "itemSaveDc": 13
}
```

`actionType: "bonus"` is correct and load-bearing: Ensnaring Strike is cast as a Bonus
Action, so the Encounter page's action filter puts the item under *Bonus*.

### Persistence and sync

- `useCharacter` persist version **5 → 6**; the migration backfills `weapons: []`.
  `loadCharacter` gains the same `weapons ?? []` backfill it already does for
  `innateSpells` and `racialFreeCastsUsed`.
- **Weapons are NOT added to `DurableSheet`.** They are authored in the character JSON,
  which is byte-identical on every device, so syncing them would add the shape-drift
  hazard the coin store already had to defend against, for no gain. Charges used are
  session state and are excluded for the reason the file comment already gives.
  Revisit only if an in-app weapon editor is ever built.

## Behaviour

### Attacks panel — Dashboard

New `src/components/panels/AttacksPanel.tsx`, rendered in `Dashboard.tsx` directly after
`<AcPanel />` in the left `md:col-span-4` column. It copies AcPanel's chrome exactly
(`bg-surface-container border border-outline-variant/30 rounded-xl p-md relative
overflow-hidden`, the `leather-noise` layer, `font-serif text-title-sm text-primary`
heading) and reuses its `BreakdownRow` idiom.

Per weapon: a round badge with the signed attack bonus, the name, `1d8+5 Piercing`, the
range, the properties, the optional note, and a breakdown listing ability modifier,
proficiency and magic bonus. When `proficient` is false the proficiency row is still
shown, as `—` with the hint `not proficient`, because a silently missing row looks the
same as a bug.

The panel renders nothing at all when `weapons` is empty, so every other character is
unaffected.

### Maths — `src/lib/weapons.ts` (new, pure, TDD)

```ts
weaponAttackBonus(c, w) = abilityMod(abilityScore(c, w.ability))
                        + (w.proficient ? c.proficiencyBonus : 0)
                        + (w.magicBonus ?? 0)

weaponDamageBonus(c, w) = abilityMod(abilityScore(c, w.ability)) + (w.magicBonus ?? 0)
weaponDamageLabel(c, w) = `${w.damageDice}${signed-or-omitted bonus} ${w.damageType}`
```

A zero damage bonus renders as `1d8 Piercing`, not `1d8+0 Piercing`; a negative bonus
renders `1d8-1`. `abilityScore` is the existing helper, so feat and magic ability bonuses
are already included.

### Item casting — Encounter

`CompactResourceRow` gains, when `grantsSpell` is set and the spell resolves in
`innateSpells`:

- a **Cast** button, disabled at 0 charges, which spends 1 charge (`useResource(name)`)
  and, because the spell has `concentration: true`, sets concentration via the existing
  `setConcentration(spellName, level)`. The existing `ConcentrationBar` then shows it.
- the DC line `DC 13 (item) · DC 15 (yours)`, from `itemSaveDc` and `spellSaveDc(c)`.
  If `itemSaveDc` is absent only the character's DC is shown.
- an expandable spell description, matching how `CompactSpellRow` already reveals text.

Casting from the item never touches spell slots — the charge is the cost.

### Dawn recharge

A shared `src/components/DawnRecharge.tsx`, used by both `CompactResourceRow` (Encounter)
and `ResourceCard` (Dashboard), so the control is identical in both places. Rendered only
when `rechargeDice` is set.

A ☀ button opens a small inline input: *"Roll 1d6 and enter the result."* Entering `n`
calls a new store action `rechargeResource(name, n)` → `used = max(0, used - n)`, which
caps at full naturally. The button label previews the outcome as you type, matching the
hit-dice input in `RestMenu`. Input is clamped to 1..6 by parsing the dice string's
right-hand side; a non-numeric or empty entry does nothing.

`longRest` stops zeroing resources that have `rechargeDice` set — those recover only
through their own dawn control. Plain `dawn` resources without dice, such as the sample
wizard's wand, keep today's behaviour; changing that is out of scope.

## Testing

Unit, `src/lib/weapons.test.ts`: proficient and non-proficient attack bonus, magic bonus
present and absent, damage label for positive, zero and negative bonuses, and that a feat
ability bonus (Brunella's Dex 15+2) is counted.

Unit, store: `rechargeResource` clamps at 0 used and ignores overshoot; `longRest` leaves
a `rechargeDice` resource untouched while still clearing a plain `dawn` one.

Component, jsdom (per-file `// @vitest-environment jsdom`, explicit `afterEach(cleanup)`
since vitest globals are off): AttacksPanel renders `+5` and `1d8+5 Piercing` for
Brunella's bow and renders nothing when `weapons` is empty; the item row disables Cast at
0 charges and spends exactly one charge on click.

Manual, headless Chrome over CDP against the dev server, because jsdom is not the
browser: load Brunella, confirm the Dashboard panel, cast from the Encounter item, see
concentration appear, run a dawn recharge.

## Risks

- **`Resource` is keyed by `name`, not `id`,** throughout the store. Two resources with
  the same name both mutate. The bow's resource name must stay unique per character.
- **`grantsSpell` is a string reference** that can dangle if the spell is renamed in
  `innateSpells`. The row degrades to a plain counter rather than crashing.
- **The user must reload Brunella from the library** for any of this to reach her
  devices, since none of it syncs. This is the same reload Astral Flood already needs, so
  the two ship as one reload if this lands before she does it.

## Open questions

None. Proficiency (no), save DC (show both), recharge (own dawn button) and panel scope
(numbers only) were all settled in the brainstorm.
