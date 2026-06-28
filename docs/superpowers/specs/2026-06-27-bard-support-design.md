# Bard Class Support — Design Spec

**Date:** 2026-06-27
**Branch:** `feat/bard-support` (from `main`)
**Status:** Approved (design)

## Problem statement

Arcanist's Ledger is an in-session D&D 5e (2024) companion. The data model is
mostly class-agnostic, but several behaviors are still hardcoded to Wizard/INT,
and some Bard class mechanics are not modeled at all. We want to support a Bard
character (specifically **Brunella**, a level 5 College of Lore bard) so the
app is mechanically correct for her at the table.

## Goal

Make the app correctly support a CHA-based, prepared-caster Bard with
College of Lore features, then author Brunella's character JSON and add her to
the cloud character library.

## Scope decisions (confirmed with user)

- **Depth:** Full / mechanically active support.
- **Jack of All Trades:** derived from class + level (`className === "bard" && level >= 2`).
- **Ritual rule:** derived from class (Wizard → cast any ritual from spellbook; others → only *prepared* rituals).
- **Subclass:** College of Lore (first Bard college in the registry).
- **Character level:** 5.
- **Branch:** new `feat/bard-support` from `main`.
- **Terminology:** keep existing Wizard-flavored copy ("Spellbook", "Spell Slot
  Reservoirs", etc.) as-is for now — NOT making it class-aware in this pass.

## Out of scope

- Renaming Wizard-flavored UI copy to be class-aware.
- Bard colleges other than Lore (Valor/Dance/Glamour).
- Lore L6+ features (Magical Secrets, Peerless Skill) — Brunella is L5.
- Multiclass / non-string class handling.
- A general per-class registry (`classRegistry`) — class features that need data
  (Bardic Inspiration) are authored in the character JSON, reusing existing
  `Resource` + inspire-deck infrastructure.

## Part 1 — Code changes (generic, class-derived)

### 1. Jack of All Trades — `src/lib/skills.ts`

- Add `isJackOfAllTrades(c: Character): boolean` =
  `c.className.trim().toLowerCase() === "bard" && c.level >= 2`.
- In `skillModifier`: when the skill is **neither** proficient **nor** expertise
  and `isJackOfAllTrades(c)` is true, add `Math.floor(c.proficiencyBonus / 2)`.
- `passivePerception` already delegates to `skillModifier`, so it is covered
  automatically (JoAT applies to Perception only when not proficient — RAW).

### 2. Ritual casting rule (derived) — `src/store/character.ts` + `src/views/Spellbook.tsx`

- Add a pure helper `availableRituals(c: Character): Spell[]` in the store:
  - Wizard (`className === "wizard"`) → all spells in `spellbook` with `ritual`.
  - Otherwise → spells in `spellbook` with `ritual` that are ALSO in
    `preparedSpells`.
- `Spellbook.tsx` uses `availableRituals(c)` for the Rituals tab instead of the
  inline `c.spellbook.filter((s) => s.ritual)`.
- The Rituals tab subtitle becomes class-aware (factual correctness only):
  Wizard keeps its current text; others read "cast only prepared rituals
  (+10 min, no slot)".

### 3. INT bug fix — `src/views/Spellbook.tsx:77`

- Replace the hardcoded `c.abilities.int` DC/attack math in the header subtitle
  with the existing `spellSaveDc(c)` / `spellAttackBonus(c)` helpers, which honor
  `spellcastingAbility`. Fixes the header for any non-INT caster.

### 4. College of Lore — `src/lib/subclassRegistry.ts`

- Add a `bardLore(ctx)` grant function, gated at `ctx.level >= 3`, registered
  under key `"bard:lore"`.
- Returns passive reminder `Resource`s (`max: 0`, `recharge: "manual"`, pattern
  of "Improved Illusions"):
  - **Cutting Words** (Lore L3): Reaction — when a creature you can see within
    60 ft makes a damage roll or succeeds on a D20 Test, expend one Bardic
    Inspiration use, roll the die, and subtract it from that roll.
  - **Bonus Proficiencies** (Lore L3): you gain proficiency in three skills of
    your choice (informational reminder).

## Part 2 — Character data (authored, no new code)

### 5. Bardic Inspiration + Font of Inspiration → character JSON

- A `Resource` named `"Bardic Inspiration"`:
  - `max` = CHA modifier, `used: 0`, `recharge: "short"` (Font of Inspiration,
    L5 — the store already resets `short` resources on short AND long rest).
  - `desc` covers: die scaling (d8 at L5), uses = CHA mod, Font of Inspiration
    (regain on short rest; or spend a spell slot as a Bonus Action to regain one
    use), and a pointer to Cutting Words.
  - `inspirePhraseDeck: "brunella"`.

### 6. Inspire-phrase deck — `src/data/inspirePhrases.ts`

- Add a `brunella` deck. Phrases authored collaboratively when we define her
  personality (first pass, then refine — per the user's stated preference).

### 7. Brunella's character JSON — `public/characters/brunella.json` + `manifest.json`

- Level 5, `className: "Bard"`, `subclass: "Lore"`, `proficiencyBonus: 3`.
- Abilities: CHA primary (values set during collaborative build).
- `savingThrowProficiencies: ["dex", "cha"]`.
- `hitDice: { die: 8, max: 5, spent: 0 }`.
- `spellcastingAbility: "cha"`.
- `spellSlotsMax`/`spellSlots`: `{ "1": 4, "2": 3, "3": 2 }`.
- 3 cantrips; 9 prepared spells referencing a `spellbook` list.
- `skills`: 2 Expertise (L2) + 3 bonus proficiencies (Lore L3) + the bard's
  starting skill proficiencies.
- `initiativeBonus`: Dex mod + JoAT half-PB baked in.
- Add a matching entry to `public/characters/manifest.json`.

## Part 3 — Tests (TDD)

- `src/lib/skills.test.ts` — Jack of All Trades:
  - Bard L5, non-proficient skill → `+floor(3/2) = +1` over base ability mod.
  - Proficient skill → unchanged (full PB, no JoAT).
  - Expertise skill → unchanged (2×PB, no JoAT).
  - Non-bard (Wizard) → no JoAT.
  - Bard L1 → no JoAT (gated at L2).
  - `passivePerception`: +1 when not proficient, full PB when proficient.
- New ritual helper test (`src/store/character.test.ts` or `skills`-style file):
  - Wizard → `availableRituals` returns all spellbook rituals.
  - Bard → returns only prepared rituals.

## Validation

- `npx tsc --noEmit`
- `npx vitest run`
- `npx vite build`

## Risks

- Deriving behavior from the `className` string is fragile for custom names /
  multiclass — accepted per user decision (companion app, curated library).
- `availableRituals` changes the Rituals tab for any non-Wizard already in the
  library — only Lyari (Wizard) exists today, so no regression.

## Acceptance criteria

- A level-5 College of Lore bard loads from the library with correct spell DC /
  attack (CHA), CHA-mod Bardic Inspiration uses that recharge on a short rest,
  Cutting Words + Bonus Proficiencies reminders, prepared-only ritual list, and
  Jack of All Trades applied to non-proficient skill checks and passive
  Perception.
- `tsc`, `vitest`, and `vite build` all pass.
