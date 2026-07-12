# Arcanist's Ledger — Project Instructions

D&D 5e (2024 rules) **in-session companion** for playing at the table with
physical dice (manual roll input) — not a character builder. React + Vite +
Zustand, deployed on Vercel (arcaneledger.vercel.app).

## Feature workflow (how we work here)

For any feature: **brainstorm → spec → plan → implement**, but the approval gates
are calibrated as follows:

1. **Spec** — write the design spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
   and commit it. **The user reviews the spec** (this gate stays).
2. **Plan** — after spec approval, write the implementation plan, **persist it**
   (`docs/plans/YYYY-MM-DD-<topic>-plan.md`) and commit it, then **proceed
   DIRECTLY to implementation**. Do **not** wait for inline plan approval each
   time. The persisted plan is the artifact of record: if a discrepancy shows up
   later, the user reviews the committed plan and we discuss from there.
3. **Implement** — go straight through once the plan is committed.

Rationale: the user wants to review the *spec* and have the *plan on file* for
accountability, but does not want to hand-approve every plan inline.

## Conventions

- Dev server runs on port **5180** (5173 conflicts with another app). Restart the
  server after Tailwind config changes — stale servers serve old CSS.
- **D&D RAW first:** research the full rule before implementing a mechanic.
- Zustand `persist` stores: bump the store `version` (and add a `migrate`) when
  the persisted shape changes, so users keep their data instead of re-importing.
- Branch rules: never commit on `main`. Feature branches only (`feat/*`, `fix/*`,
  `chore/*`). Never push without asking.
