# Design — Visible app version, update prompt, and editable max HP

Date: 2026-08-01
Status: approved (user reviewed the design inline before this doc was written)

## Problem

Two problems, discovered together while using the app as an installed PWA on a tablet.

**1. No way to tell which build you are looking at.** Nothing in the UI states a
version. `package.json` has been pinned at `0.1.0` since the repo started, so it
carries no signal either. When a feature appears to be missing, there is no way to
distinguish "not implemented yet" from "this device is running a stale build".

That ambiguity is not hypothetical: the app is a PWA (`vite-plugin-pwa`, Workbox
`generateSW` with a precache). An installed PWA that is never fully closed can keep
serving an old precached build. The service worker only looks for a new version on
page load, so a tablet that stays open in the background can sit on a stale build
indefinitely, silently.

**2. Max HP cannot be edited.** `hpMax` is part of the synced `DurableSheet`, so it
travels between devices — but no UI ever changes it. The store action `setMaxHp`
exists (`src/store/character.ts:140`) and is correct; simply nothing calls it. A grep
across the repo confirms zero call sites. Today the only way to change max HP is to
re-import the character. (`level` and `proficiencyBonus` are in the same situation and
do not even have store actions — explicitly out of scope here.)

## Goals

- Show, in the app, exactly which build is running — traceable to a commit.
- Detect when a newer build is available and let the user apply it deliberately.
- Make max HP editable at the table, in one tap, from the HP panel.

## Non-goals

- Editing `level` or `proficiencyBonus` (no store actions exist; separate feature).
- A full "edit character sheet" screen.
- Semantic versioning or release tagging. Manual version bumps have already proven
  they get forgotten.
- Adding React Testing Library / jsdom to the project.

---

## Part A — Visible version and update prompt

### Version identity

Injected at build time via `define` in `vite.config.ts`:

| Constant | Source | Fallback |
|---|---|---|
| `__APP_COMMIT__` | `VERCEL_GIT_COMMIT_SHA` (first 7 chars) on Vercel; `git rev-parse --short HEAD` locally | `"dev"` |
| `__APP_BUILD_TIME__` | ISO timestamp at config evaluation | — |

The git call is wrapped in try/catch so a build from a tarball (no `.git`) still
succeeds. Both constants are declared in a `.d.ts` so TypeScript sees them.

`src/lib/appVersion.ts` reads the globals and exports:

- `APP_COMMIT`, `APP_BUILD_TIME`
- `formatVersion(commit, buildTime): string` — a **pure** function returning
  `"f4b3544 · 1 ago 2026, 15:04"`. Pure so it is unit-testable without a DOM.

### Update detection

`registerType` changes from `"autoUpdate"` to `"prompt"`, and `injectRegister` is set
to `null` so the plugin does not also auto-register (double registration otherwise).

`src/lib/swUpdate.ts` wraps `registerSW` from `virtual:pwa-register` in a small
Zustand store exposing `{ needRefresh, updateNow() }`. On registration it schedules
`registration.update()`:

- every 60 minutes, and
- on `focus` and `online`

mirroring the throttled pattern `src/main.tsx` already uses for cloud sync. This is the
part that actually fixes the stale-tablet problem: without it the SW only checks on
page load.

### UI

- **Settings → "Acerca de"**: app name, `formatVersion()` output, and status —
  "Actualizada" or "Actualización disponible".
- **Update bar**: when `needRefresh` is true, a discreet bar with an "Actualizar"
  button calling `updateNow()` (which calls `updateServiceWorker(true)` and reloads).

Both are theme-aware (CSS-variable tokens, per the convention established by the
light/dark refactor) and keyboard-accessible.

### Known limitation (accepted)

This does not retroactively fix an already-stale install. The service worker currently
on the tablet must update itself once before any of this code is running there. The
user needs one manual reload (or fully closing and reopening the PWA) to pick up the
build that introduces the prompt. From then on it self-reports.

---

## Part B — Editable max HP

Purely a UI change in `src/components/panels/HpPanel.tsx`. No store, no API, no
serverless change.

- The `OF {max} HP` text becomes a button. Activating it swaps it for a number input
  seeded with the current max.
- **Enter** or **blur** commits; **Escape** cancels. Empty or non-numeric input is
  discarded (no write).
- Commit calls the existing `setMaxHp`, which already clamps to a minimum of 1 and
  clamps current HP down to the new max.
- Accessibility: the trigger carries an explicit `aria-label`; the input is labelled
  and receives focus when edit mode opens.

**Sync is free.** `src/store/sync.ts` subscribes to `useCharacter` and pushes any
character change on a 1.5s debounce, with a `hydrating` guard against echo. Editing
max HP therefore propagates to the cloud with no extra wiring.

---

## Testing

The project has no React Testing Library and no jsdom; all 115 existing tests are pure
logic and store tests. That convention is kept.

- New unit test for `formatVersion()` — formatting and the `"dev"` fallback.
- Store test for `setMaxHp` clamping (min 1, current clamped down). Confirmed absent
  from `src/store/character.test.ts` — the action ships untested today.
- The interactive HP editing and the update prompt are verified manually on a preview
  deployment.

## Risks

- **`registerType` change affects existing installs.** Transitional only: the old
  auto-updating SW replaces itself with the prompt-based one on the next load.
- **Build-time git call.** Guarded with try/catch; falls back to `"dev"`.
- **Clock skew on build time.** Cosmetic only — the commit hash is the real identity.

## Acceptance criteria

1. Settings shows a version traceable to the deployed commit, and it differs between
   two different deploys.
2. With a newer build published, the app surfaces "Actualizar" without a manual reload
   (within the periodic check window, or on focus/online).
3. Tapping the max HP value opens an input; committing changes the max, clamps current
   HP if needed, and survives a reload.
4. The edited max HP appears on a second device after a sync.
5. `npm test` and `npm run build` stay green.
