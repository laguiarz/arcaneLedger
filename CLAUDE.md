# Arcanist's Ledger — Project Instructions

D&D 5e (2024 rules) **in-session companion** for playing at the table with
physical dice (manual roll input) — not a character builder. React + Vite +
Zustand, deployed on Vercel (arcaneledger.vercel.app).

## Feature workflow (how we work here)

For any feature: **brainstorm → spec → critic → plan → implement**.

**There is NO user approval gate on the spec or the plan.** Do not stop and ask
the user to review either one. Run the whole chain and report at the end.

1. **Brainstorm** — this is where the user is involved. Ask the design questions
   here, get the decisions, then stop asking.
2. **Spec** — write it to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
   and commit it.
3. **Critic** — dispatch a **subagent** to review the committed spec before any
   plan exists. Its job is to attack the spec: unstated assumptions, missing edge
   cases, contradictions, scope creep, decisions that will hurt later. Read its
   findings, fix what is genuinely wrong (say so if a finding is wrong — do not
   apply feedback reflexively), and commit the revisions.
4. **Plan** — write the implementation plan, persist it to
   `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`, commit it, and proceed
   **DIRECTLY** to implementation.
5. **Implement** — straight through once the plan is committed.

Rationale: the user does not want to hand-review specs and plans, but wants them
on file as the artifacts of record, with an independent critic catching what a
single pass misses. If a discrepancy shows up later, the committed spec and plan
are what we go back to.

## Conventions

- Dev server runs on port **5180** (5173 conflicts with another app). Restart the
  server after Tailwind config changes — stale servers serve old CSS.
- **D&D RAW first:** research the full rule before implementing a mechanic.
- Zustand `persist` stores: bump the store `version` (and add a `migrate`) when
  the persisted shape changes, so users keep their data instead of re-importing.
- Branch rules: never commit on `main`. Feature branches only (`feat/*`, `fix/*`,
  `chore/*`). Never push without asking.
