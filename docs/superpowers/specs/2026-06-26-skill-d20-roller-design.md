# Skill d20 Roller — Design

**Date:** 2026-06-26
**Branch:** `feat/skills-page`
**Status:** Approved

## Problem

The Skills page is read-only: it shows each skill's modifier but offers no way to
make a check. The user wants a quick, satisfying way to roll a skill check from
the page, with a rolling-d20 animation.

## Goal

Add a per-skill "roll" affordance that rolls a digital d20, adds the skill
modifier, and presents the result in an epic central overlay with a rolling-die
animation.

## Decisions (from brainstorming)

- **Digital RNG** — the app generates the d20; it does not capture a physical die.
- **One die icon per skill row**, to the right of the modifier. Tapping the die
  rolls that skill; tapping elsewhere on the row keeps the current expand/collapse
  breakdown behavior.
- **Normal rolls only** (1d20). No advantage/disadvantage for now.
- **Central overlay**: a large d20 spins (~700ms), settles on the natural roll,
  then shows `Skill · total · d20 (natural) + mod`.
- **Nat 20 / Nat 1** get visual flair only (golden glow / muted). Skill checks do
  not crit in RAW — purely cosmetic.

## Scope

- Pure dice logic: `rollD20`, `rollSkillCheck`.
- A roll overlay (reuses existing `Modal`) with rolling animation + "roll again".
- Die-icon button per skill row wired to open the overlay.
- `prefers-reduced-motion`: skip the spin, render the settled result immediately.
- Accessibility: die button has an `aria-label` (e.g. "Roll Perception").

## Out of scope (YAGNI)

Advantage/disadvantage, roll history/log, manual physical-die entry, sound,
saving throws / other check types, persisting rolls. No change to the `Character`
model or persistence — the page stays read-only over the character.

## Architecture

```
src/lib/dice.ts            (new)  pure: rollD20(rng?), rollSkillCheck(c, skill, rng?)
src/lib/dice.test.ts       (new)  range + total === natural + mod, deterministic rng
src/components/SkillRollModal.tsx (new)  useSkillRoll() hook -> { roll(skill,label), modal }
src/views/Skills.tsx       (edit) die button per row; mount the hook + modal once
```

### `dice.ts`

```ts
rollD20(rng = Math.random): number            // 1..20 inclusive
rollSkillCheck(c, skill, rng = Math.random):  // { natural, mod, total }
  { natural: number; mod: number; total: number }
```

`rng` is injectable so tests are deterministic. `mod` comes from the existing
`skillModifier(c, skill)`; `total = natural + mod`.

### `SkillRollModal.tsx`

`useSkillRoll()` mirrors the existing `useInspire()` pattern: returns a `roll`
function (sets current skill/result and opens the overlay) plus a `modal` element
mounted once on the page. Animation is CSS-driven (spin transform + cycling
display number via an interval) that settles on `natural`. Honors
`prefers-reduced-motion` by skipping the animation.

### `Skills.tsx`

`SkillRow` gains a die `<button>` (Material symbol `casino`) after the modifier.
`onClick` calls `stopPropagation()` then `roll(skill, label)` so it does not
toggle the breakdown. The hook + modal are instantiated once in the `Skills`
component and `roll` is threaded down to each row.

## Testing

- `rollD20` returns within 1..20 for boundary rng values (0 → 1, ~0.999 → 20).
- `rollSkillCheck` total equals `natural + skillModifier` for proficient,
  expertise, and non-proficient skills (deterministic rng).

## Acceptance criteria

1. Each skill row shows a die button; tapping it opens the overlay and does not
   toggle the row breakdown.
2. The overlay animates a rolling d20, settles on a 1–20 natural, and shows
   `total = natural + modifier` with the breakdown.
3. "Roll again" re-rolls the same skill.
4. Nat 20 and Nat 1 get distinct cosmetic styling.
5. With `prefers-reduced-motion`, the result shows without the spin.
6. `npm run typecheck`, `npm test`, and `npm run build` all pass.

## Risks

- Animation timing/feel is subjective — keep the CSS simple and tweakable.
- Reduced-motion path must not leave the die mid-spin.
