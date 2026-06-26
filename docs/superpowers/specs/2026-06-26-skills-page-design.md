# Skills Page — Design Spec

**Date:** 2026-06-26
**Branch:** `feat/skills-page`
**Status:** Approved (brainstorming) → implementation

## Problem

Arcanist's Ledger (D&D 5e in-session companion) has no view for ability skills.
Players need to see their 18 skill modifiers at the table, including which skills
they're proficient/expert in, plus Passive Perception. The data exists in Fight
Club XML exports only as opaque numeric `<proficiency>` IDs / free-text feat
descriptions, neither of which the importer currently parses.

## Goal

A read-only **Skills** page showing all 18 D&D 2024 skills with computed
modifiers, proficiency/expertise markers, Passive Perception, and a tap-to-expand
breakdown. Per-character skill data comes from curated JSON (library characters),
not from XML parsing.

## Decisions (from brainstorming)

- **Data source:** curated JSON (`skills` block authored per library character).
  XML parsing of skills is **out of scope**.
- **Read-only:** no in-app editing, no store mutations, no persist bump.
- **Extras:** Passive Perception header + tap-to-expand breakdown.
- **Skill order:** official D&D 2024 PHB order — grouped by governing ability
  (STR → DEX → INT → WIS → CHA), alphabetical within each ability.

## Data Model

`src/types/character.ts` — additive, optional field (no persist migration):

```ts
export type SkillName =
  | "athletics"                                              // STR
  | "acrobatics" | "sleightOfHand" | "stealth"               // DEX
  | "arcana" | "history" | "investigation" | "nature" | "religion" // INT
  | "animalHandling" | "insight" | "medicine" | "perception" | "survival" // WIS
  | "deception" | "intimidation" | "performance" | "persuasion";          // CHA

export interface SkillProficiency {
  proficient?: boolean;
  expertise?: boolean; // expertise implies proficient
}

// added to Character:
skills?: Partial<Record<SkillName, SkillProficiency>>;
```

### Static reference (`src/lib/constants.ts`)

- `SKILLS_IN_ORDER: { name: SkillName; ability: Ability; label: string }[]`
  in the official 2024 order below (this array IS the canonical RAW skill→ability
  map and the display order — single source of truth).

| # | Skill | Ability |
|---|-------|---------|
| 1 | Athletics | STR |
| 2 | Acrobatics | DEX |
| 3 | Sleight of Hand | DEX |
| 4 | Stealth | DEX |
| 5 | Arcana | INT |
| 6 | History | INT |
| 7 | Investigation | INT |
| 8 | Nature | INT |
| 9 | Religion | INT |
| 10 | Animal Handling | WIS |
| 11 | Insight | WIS |
| 12 | Medicine | WIS |
| 13 | Perception | WIS |
| 14 | Survival | WIS |
| 15 | Deception | CHA |
| 16 | Intimidation | CHA |
| 17 | Performance | CHA |
| 18 | Persuasion | CHA |

## Calculation (pure, testable)

`src/lib/skills.ts`:

```ts
skillModifier(c: Character, skill: SkillName): number
// = abilityMod(c.abilities[ability])
//   + (expertise ? 2 * c.proficiencyBonus
//       : proficient ? c.proficiencyBonus : 0)

passivePerception(c: Character): number
// = 10 + skillModifier(c, "perception")
```

- `abilityMod(score) = Math.floor((score - 10) / 2)`.
- Missing `skills` entry → treated as `{ proficient: false }` (base ability mod).
- `expertise: true` adds 2×PB regardless of the `proficient` flag.

## UI

`src/views/Skills.tsx` — follows `SavesPanel` / Spellbook styling conventions
(Tailwind, leather/parchment dark theme, `glass-card`, `SectionHeader`, `Icon`).

Layout:
1. `SectionHeader` (icon `checklist`, title "Skills").
2. **Passive Perception** highlighted card (large number).
3. List of the 18 skills in the table order above, grouped under ability
   sub-headers (STR/DEX/INT/WIS/CHA). Each row:
   - proficiency marker: empty dot (none) / filled star (proficient) /
     double/gold star (expertise);
   - skill label;
   - ability chip (e.g. INT);
   - signed modifier (e.g. `+5`), large serif.
4. **Tap a row** → expands an inline breakdown:
   `ability mod (+3) + proficiency (+3) + expertise (+3) = +9`.
   No dice rolling (player rolls physical dice).

Read-only: no toggles, no store writes.

## Routing / Nav

- `src/App.tsx`: add `<Route path="/skills" element={<Skills />} />`.
- `src/components/AppShell.tsx`: add `{ to: "/skills", label: "Skills",
  icon: "checklist" }` to `NAV_ITEMS`, positioned between Spellbook and Settings.
  Renders automatically in sidebar + mobile nav.

## Lyari's skill data

Add a `skills` block to **both** `data/Lyari_Mistweaver.json` and
`public/characters/lyari.json`. From the XML, firmly decoded:

- **Investigation** — proficient (Artisan background)
- **Persuasion** — proficient (Artisan background)

Remaining (Wizard 2024 picks ×2, Scholar L2 expertise ×1, Keen Senses racial ×1)
are encoded only as numeric proficiency IDs. First-pass authored values
(**user to confirm/correct on review**):

- **Arcana** — proficient + expertise (Wizard skill + Scholar expertise)
- **History** — proficient (Wizard skill)
- **Perception** — proficient (Keen Senses racial)

## Tests

`src/lib/skills.test.ts` (Vitest):
- `abilityMod` boundaries (8→-1, 10→0, 16→+3, 6→-2).
- `skillModifier`: none / proficient / expertise cases with a known PB.
- `passivePerception` = 10 + perception modifier.
- Character with `skills` undefined → all skills = base ability mod.

## Out of scope

- Parsing skills from Fight Club XML on import (future: ID→skill map).
- In-app editing of proficiencies.
- Passive Investigation / Insight.
- Jack of All Trades, Reliable Talent, situational bonuses.

## Files touched

| File | Change |
|------|--------|
| `src/types/character.ts` | add `SkillName`, `SkillProficiency`, `Character.skills` |
| `src/lib/constants.ts` | add `SKILLS_IN_ORDER` |
| `src/lib/skills.ts` | new — `skillModifier`, `passivePerception`, `abilityMod` reuse |
| `src/lib/skills.test.ts` | new — unit tests |
| `src/views/Skills.tsx` | new — page component |
| `src/App.tsx` | add `/skills` route |
| `src/components/AppShell.tsx` | add nav item |
| `data/Lyari_Mistweaver.json` | add `skills` block |
| `public/characters/lyari.json` | add `skills` block |
