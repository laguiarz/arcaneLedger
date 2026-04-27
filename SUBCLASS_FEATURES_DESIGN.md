# Subclass Features — Design (Wizard 2024)

Mini-design for adding wizard subclass feature loading. Pick this up cold next session.

## Goal

Surface subclass-granted **session-relevant abilities** (cantrips, free-cast spells, limited resources, action-economy reminders) the same way `featRegistry.ts` already does for character-root feats. Scope: Wizard 2024 only (Lyari is the only PC; Phase 1 is Illusionist L3-5).

## Current state — what already exists

- `Character.subclass` is **already** populated from the XML. `inferSubclass` in `src/lib/importFightClubXml.ts:157-165` extracts e.g. `"Illusionist"` from `<feat><name>Level 3: Wizard Subclass Illusionist</name>`.
- `featRegistry.ts` (just shipped) is the **template pattern**: a name-keyed map of handlers that take `FeatContext` and return `{ cantrips?, innateSpells?, resources? }`. The importer applies each handler and dedupes against existing entries.
- `Resource` with `max: 0`, `recharge: "manual"` is the convention for at-will/passive ability reminders (see `sampleWizard.ts` "Sculpt Spells" and the new "Telekinetic Shove").
- Free-cast tracking: `Character.innateSpells[].freeCastsPerLongRest` + `Character.racialFreeCastsUsed: Record<spellName, number>`. Currently per-spell-name only.

## Proposed approach: `SUBCLASS_REGISTRY`

New file `src/lib/subclassRegistry.ts`, same shape as `featRegistry.ts` but:

1. **Keyed by `${className}:${subclass}`** lowercased — e.g. `"wizard:illusionist"`.
2. **Handler receives level** in context, returns features applicable at-or-below that level (subclass features unlock at L3, L6, L10, L14).
3. **Grants type extends with modifiers**, because subclass features often *modify* existing spells/cantrips rather than just adding new ones (see Improved Illusions below).

```ts
interface SubclassGrants {
  cantrips?: Cantrip[];
  innateSpells?: Spell[];
  resources?: Resource[];
  // Per-name patches for specific spells/cantrips.
  modifyCantrip?: Array<{ name: string; patch: Partial<Cantrip>; appendDesc?: string }>;
  modifySpell?: Array<{ name: string; patch: Partial<Spell>; appendDesc?: string }>;
  // School-wide rules — applied to every cantrip/spell of the named school
  // already present on the character (after class spells + feat registry).
  schoolModifiers?: Array<{
    school: SpellSchool;
    rangeBonus?: number;       // appends " + N feet" to ranges measured in feet >= rangeMinFeet
    rangeMinFeet?: number;     // default 10; "Self", "Touch", and ranges below are skipped
    stripComponents?: Array<"V" | "S" | "M">; // adds to SpellBase.componentsStripped
  }>;
}

interface SubclassContext {
  abilities: AbilityScores;
  proficiencyBonus: number;
  level: number; // class level — drives which features are active
}
```

Importer integration: after the `FEAT_REGISTRY` pass in `importFightClubXml.ts`, look up `${className}:${subclass}` in `SUBCLASS_REGISTRY`, apply grants, then apply modifiers (after cantrips/spells are already populated by feat-registry + class spells).

## Data-model gaps — DECIDE BEFORE CODING

The four 2024 wizard subclasses each surface at least one mechanic that doesn't fit `Resource`. List them with proposed solutions:

### 1. Arcane Ward (Abjurer L3) — HP pool, not a counter

Mechanic: pool with `max = 2 × wizard_level + INT_mod`, current HP, absorbs damage, recovers HP via casting Abjuration spells (regain `2 × slot_level`) OR by spending a slot as a bonus action (also `2 × slot_level`). Created **once per long rest** by casting an L1+ Abjuration spell.

- **Resource doesn't fit.** It's HP, not a count of uses. It has *two* recovery mechanics both keyed off spell-slot level.
- **Proposal**: add `Character.ward?: { current: number; max: number; created: boolean }` — `created` resets on long rest, current/max recompute when created.
- **Alt (over-general)**: `Character.pools: Pool[]` to handle hypothetical future similar mechanics. Not worth it for one PC.

### 2. Portent (Diviner L3 / Greater Portent L14) — stored d20 values

Mechanic: roll **2 d20s** at long rest (3 at L14), keep the values, replace any d20 test with one of them, then discard the value used. Each foretelling is single-use.

- **Resource doesn't fit.** Need to store the actual rolled numbers, not just a count.
- **Proposal**: add `Character.portent?: { values: number[]; max: 2 | 3 }`. UI: pip-style display showing the rolled values, click to spend (move to "used"), reset button on long rest enters new values manually (per the user's at-the-table physical-dice workflow per `feedback_dnd_raw_rules.md`).

### 3. Shared free-cast budget across multiple spells (Illusionist L6 Phantasmal Creatures)

Mechanic: always have Summon Beast AND Summon Fey prepared. **One** free cast per long rest (of *either* spell, not one each). The free cast halves the summoned creature's HP.

- Current `racialFreeCastsUsed` is `Record<spellName, number>` — can't express "shared budget across multiple names".
- **Proposal A (smaller)**: add `Character.sharedFreeCasts?: Array<{ id: string; spellNames: string[]; max: number; used: number }>`. Spells in the group reference the group via a new `Spell.freeCastGroupId` field instead of `freeCastsPerLongRest`.
- **Proposal B (defer)**: skip L6+ Illusionist features in Phase 1. Lyari is L5; we have time before this matters.

### 4. Improved Illusions modifications (Illusionist L3)

Mechanic: Minor Illusion gains Bonus Action castingTime + sound AND image. School-wide: all illusion spells lose V component and gain +60 ft range when range ≥ 10 ft.

**Approach: mutate, but transparently.** Goal is that comparing the character sheet against the handbook makes the modifications obvious — never hide what RAW says.

- **Per-name patches (Minor Illusion only)** via `modifyCantrip`: set `castingTime: "Bonus Action"`, append desc note about creating both sound and image in one cast. Range modification comes from `schoolModifiers` below (Minor Illusion is School: Illusion, range 30 ft).
- **School-wide via `schoolModifiers`**: `{ school: "Illusion", rangeBonus: 60, rangeMinFeet: 10, stripComponents: ["V"] }`. Applied to every cantrip and spell on the character with `school === "Illusion"` after class spells and feat registry have run.
- **Range display**: keep the original number and append the bonus literally. `"30 feet"` → `"30 + 60 feet"`. `"10 feet"` → `"10 + 60 feet"`. `"Self"`, `"Touch"`, and ranges below 10 ft are skipped (no mutation). The "+ 60" makes the modification visible without naming the subclass — matches at-the-table workflow where you cross-check against the handbook.
- **Component display**: V is shown crossed out, not removed. Adds a new optional field `SpellBase.componentsStripped?: Array<"V" | "S" | "M">`. Renderer shows stripped components with `<s>` (strikethrough). Source of truth `components` string stays untouched (e.g. `"V, S, M"`); display logic combines them.
- **Improved Illusions Resource (passive)**: still kept as a summary reminder — covers the "Minor Illusion is added to your cantrips known without counting against the limit" rule and links the modifications to the subclass for at-the-table reference.

## Phasing

**Phase 1 — Illusionist L3 only (Lyari now)**

- New file `src/lib/subclassRegistry.ts` with `wizard:illusionist` entry returning, when `level >= 3`:
  - `modifyCantrip`: Minor Illusion → `castingTime: "Bonus Action"`, append both-sound-and-image note.
  - `schoolModifiers`: `{ school: "Illusion", rangeBonus: 60, rangeMinFeet: 10, stripComponents: ["V"] }`.
  - `resources`: passive "Improved Illusions" reminder (max 0, recharge manual) — summary + ties the mutations to the subclass.
- Importer: load and apply after FEAT_REGISTRY. Add `modifyCantrip` / `modifySpell` / `schoolModifiers` machinery.
- Add optional field `SpellBase.componentsStripped?: Array<"V" | "S" | "M">` (no persist bump — optional fields are backwards-compatible).
- Update spell display component to render `componentsStripped` entries with `<s>` strikethrough alongside `components`.
- Skip "Illusion Savant" — build-time only, not session-relevant (belongs to Phase 2 builder).
- User re-imports Lyari's XML to see the changes.

**Phase 2 — Evoker + Diviner**

- Evoker: mostly passive Resource entries (Potent Cantrip, Sculpt Spells, Empowered Evocation, Overchannel as passive notes). Easy.
- Diviner: requires `Character.portent` shape addition + new UI panel. **Persist version bumps.** Lyari (Illusionist) re-imports cleanly; future Diviner PC needs the new field.

**Phase 3 — Abjurer**

- Requires `Character.ward` shape addition + new UI panel for ward HP, slot-spend bonus action, long-rest creation flag. **Persist version bumps.**

**Phase 4 — Illusionist L6+**

- Requires `Character.sharedFreeCasts` shape if we go with Proposal A above. Persist bumps.

## RAW reference — Wizard 2024 subclass features

Source: <https://www.aidedd.org/en/wizard-2024/> (fetched 2026-04-27). 2024 PHB.

### Abjurer

- **L3 Abjuration Savant** *(passive, build-time)*: add 2 Abjuration spells (≤L2) to spellbook free; gain 1 free Abjuration spell whenever you access new spell slot levels.
- **L3 Arcane Ward** *(passive + bonus action)*: create ward with HP = 2× wizard level + INT mod when casting an Abjuration spell of L1+. Once per long rest. Ward absorbs damage (apply resistances first). Regain ward HP = 2× slot level when casting Abjuration spells, or expend a slot as a bonus action to do the same.
- **L6 Projected Ward** *(reaction)*: when a creature within 30 ft takes damage, your ward absorbs it instead.
- **L10 Spell Breaker** *(passive)*: always have Counterspell + Dispel Magic prepared; cast Dispel Magic as a bonus action with PB added to the ability check; if either spell fails to stop a spell, the slot isn't expended.
- **L14 Spell Resistance** *(passive)*: advantage on saves vs spells; resistance to spell damage.

### Diviner

- **L3 Divination Savant** *(passive, build-time)*: as Abjuration Savant but Divination school.
- **L3 Portent** *(passive)*: roll 2 d20s on long rest. Replace any d20 test (yours or a visible creature's) with one before rolling. Once per turn max. Unused dice discarded on long rest.
- **L6 Expert Divination** *(passive)*: when casting Divination spells with L2+ slots, regain one lower-level slot (max L5).
- **L10 The Third Eye** *(bonus action, 1 per short/long rest)*: choose darkvision 120 ft, read any language, or cast See Invisibility without a slot.
- **L14 Greater Portent** *(passive)*: roll 3 d20s instead of 2.

### Evoker

- **L3 Evocation Savant** *(passive, build-time)*.
- **L3 Potent Cantrip** *(passive)*: when you miss with a cantrip attack roll or the target succeeds on a save against your cantrip, the target takes half the damage (no extra effect).
- **L6 Sculpt Spells** *(passive)*: when casting an Evocation spell that affects others, choose `1 + spell level` allies; they auto-succeed and take no damage.
- **L10 Empowered Evocation** *(passive)*: add INT mod to one damage roll when casting an Evocation spell.
- **L14 Overchannel** *(action, escalating cost)*: cast Evocation spells (L1-5) at maximum damage. First use after a long rest is free; subsequent uses deal 2d12 necrotic per spell level to self, +1d12 per additional use.

### Illusionist

- **L3 Illusion Savant** *(passive, build-time)*.
- **L3 Improved Illusions** *(passive)*:
  - Cast illusion spells without verbal components.
  - Ranges of 10+ feet for illusion spells increase by 60 feet.
  - Know Minor Illusion (doesn't count against cantrips known).
  - Minor Illusion: create both sound AND image with one cast; cast as a Bonus Action.
- **L6 Phantasmal Creatures** *(passive + 1/long rest)*: always have Summon Beast and Summon Fey prepared. The summoned creatures appear illusory (Illusion school). Cast either spell once per long rest without a slot, but the creature has half HP.
- **L10 Illusory Self** *(reaction, 1/short rest OR L2+ slot)*: when hit by an attack, interpose an illusory duplicate; the attack misses automatically.
- **L14 Illusory Reality** *(bonus action while casting Illusion)*: make one inanimate, nonmagical object in the illusion real for 1 minute (can't deal damage / inflict conditions).

## Decisions (resolved 2026-04-27)

1. **Phase 2-3 shapes approved with derivation**: `Character.ward = { current: number; created: boolean }` (max derived from `2 × wizardLevel + INT_mod` at render). `Character.portent = { values: number[] }` (max derived from level: `level >= 14 ? 3 : 2`). Don't store derivable values — they rot on level-up / ability changes.
2. **Mutate in place** during the subclass pass. No `subclassOverrides` overlay. Re-import is the recovery path; matches `featRegistry.ts` precedent.
3. **Mutate illusion spells**, transparently — do NOT hide the modification. Range stays as `"X + 60 feet"` (skip Self/Touch/<10 ft). V component is rendered struck through via new `SpellBase.componentsStripped` field, not removed from `components` string. Passive "Improved Illusions" Resource still kept as summary. See section 4 above for full spec.
4. **Phase 1 = Illusionist L3 only**. Defer L6+ (Phantasmal Creatures + `sharedFreeCasts` shape) until Lyari dings.
5. **Skip build-time Savant features**. Not session-relevant — belongs to Phase 2 (builder), not the in-session companion.

## Pre-flight checklist for next session

- [ ] Read this doc + `src/lib/featRegistry.ts` (template) + `src/lib/importFightClubXml.ts:320-372` (where to plug in).
- [ ] Confirm answers to open questions 1-5 with user.
- [ ] Implement Phase 1 (Illusionist L3): `subclassRegistry.ts`, importer integration, `modifyCantrip` machinery.
- [ ] User re-imports `data/Lyari Mistweaver.xml`. Verify Minor Illusion shows Bonus Action castingTime + range 60 ft + sound-and-image note. Verify "Improved Illusions" passive entry appears in Abilities & Items.
- [ ] `npx tsc --noEmit`, `npm run build`.
