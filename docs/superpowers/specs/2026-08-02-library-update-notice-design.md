# Library update notice — design

**Date:** 2026-08-02
**Status:** approved (brainstorm)
**Branch:** `feat/library-update-notice`

## Problem statement

When a character JSON in the cloud library changes, the app never says so. The
library is read exactly once — when you tap the character in Ajustes → Library —
so a device keeps serving a stale sheet indefinitely. This bit us today: the
Ritual-Grimoire shipped in PR #23 and Brunella's sheet on her devices still does
not have it. The only way to find out is to remember that you deployed something
and go reload by hand.

The ☁ indicator in the header already answers "is my data current?", but it only
knows about Upstash. The library is a second, invisible source of staleness.

## Goal

Tell the user, in the header next to the ☁, when the library holds a newer
version of the character they are playing, and let them reload it in one tap.

## User story

> As a player at the table, when the DM (or I) publish a corrected sheet, I want
> the app to tell me my character is out of date, so I stop playing a stale
> Brunella without knowing it.

## Scope

- Give every library character a content-derived **revision** string, stamped
  into `manifest.json` by a script.
- Remember which revision the active character was loaded from.
- Check the manifest on boot / focus / online, alongside the existing sync check.
- Show a "Ficha" button in the header when the revisions differ; tapping it
  reloads the character from the library.

## Out of scope

- **Merging.** Reloading stays destructive — the library version replaces the
  sheet wholesale, exactly as it does today (decided in brainstorm). Preserving
  session state across a reload is a separate, larger feature.
- **A confirmation dialog.** Decided in brainstorm: the reload is one tap. The
  mitigation is that the button only exists while an update is pending, so there
  is nothing to mis-tap the rest of the time.
- Notifying about library characters you are *not* currently playing.
- Any change to the Upstash sync path, its flags, or its buttons.

## Decisions from the brainstorm

| Question | Decision |
|---|---|
| Where does the notice appear? | Next to the ☁ in the header |
| What happens to session state on reload? | Reset, same as today |
| How is a change detected? | Content hash, stamped by a script, enforced by a test |
| Confirm before reloading? | No — direct reload |

## Architecture

### 1. Revision identity (`scripts/`)

`public/characters/manifest.json` entries gain an optional `revision: string`.
It is a digest of that character's JSON content, computed with a stable
stringify (object keys sorted) so reformatting or key reordering does not read
as a change — the same reasoning as `digestState` in `src/lib/syncFlags.ts`.

Two node scripts, plain ESM so they run with no build step:

- `scripts/libraryDigest.mjs` — `stableStringify` + `digest`, nothing else.
- `scripts/stampLibrary.mjs` — reads the manifest, digests each
  `public/characters/<id>.json`, writes the revisions back. With `--check` it
  writes nothing and exits `1` if any revision is stale or missing.

Wiring in `package.json`:

- `"library:stamp": "node scripts/stampLibrary.mjs"` — run it by hand.
- `"prebuild": "node scripts/stampLibrary.mjs"` — npm runs this before `build`,
  so a deployed manifest is correct even if someone bypassed the tests.

**The app never computes a digest.** At runtime it only compares two strings.
Hashing lives entirely in the scripts and the guard test, which keeps the
digest algorithm out of the bundle and out of the store's contract.

### 2. Remembering what you loaded

`CharacterSummary` (`src/types/characterLibrary.ts`) gains `revision?: string`,
and `fetchLibraryManifest` stops discarding it. The manifest envelope `version`
stays at `1`: the change is additive and older clients ignore the field.

`CharacterState` gains:

```ts
/**
 * Revision of the library entry this character was loaded from. `null` when the
 * character did not come from the library, or came from a build that predates
 * revisions.
 */
libraryRevision: string | null;
```

`loadCharacter(c, opts)` widens to
`opts?: { sourceId?: string | null; revision?: string | null }` and records both.
The Settings import path (`loadCharacter(parsed)`, no opts) must clear
`libraryRevision` to `null` alongside setting `activeCharacterId = "custom"` —
an imported sheet has no library origin. `resetToSample()` clears it too.

Persist store `arcanist-ledger:character` goes **v5 → v6**; the migrate leaves
`libraryRevision` as `null` for everyone who already has data.

### 3. The check (`src/store/library.ts`)

A new, small store — deliberately separate from `useSync`:

```ts
interface LibraryState {
  /** Revision the manifest advertises for the ACTIVE character. */
  availableRevision: string | null;
  checking: boolean;
  lastError: string | null;
  check: () => Promise<void>;
  reload: () => Promise<void>;
}
```

It is separate because the library check must work with cloud sync switched
off — `useSync` short-circuits on `enabled`, and folding the library into it
would either break that guarantee or tangle two independent staleness axes.

`check()` no-ops unless the active character came from the library, fetches the
manifest, and stores the matching entry's `revision`. Failures (offline, HTTP
error) set `lastError` and leave `availableRevision` untouched — a failed check
must never look like "you are up to date" *or* like "there is an update".

`reload()` fetches the character and calls
`loadCharacter(c, { sourceId: id, revision: availableRevision })`.

`src/main.tsx` calls `check()` from the existing throttled `maybeCheck()`
(boot / `focus` / `online`) and clears `availableRevision` in the existing
`activeCharacterId` subscription, for the same reason sync clears
`remoteUpdatedAt` there: the seen revision describes the wrong character.

### 4. The decision (`src/lib/libraryFlags.ts`)

Pure, so it is testable without the store or the header — the same split that
`syncFlags.ts` exists for (the header imports the SW store, which cannot run
under Vitest).

```ts
export function libraryUpdateAvailable(a: {
  activeCharacterId: string | null;
  loadedRevision: string | null;
  availableRevision: string | null;
}): boolean;
```

| Case | Result | Why |
|---|---|---|
| `activeCharacterId` is `null`, `"sample"` or `"custom"` | `false` | Not a library character |
| `availableRevision === null` | `false` | Never checked, offline, entry gone, or the manifest predates revisions — silence beats a wrong claim |
| `loadedRevision === null` | **`true`** | Unknown origin revision ⇒ assume stale |
| otherwise | `loadedRevision !== availableRevision` | Plain comparison |

The `loadedRevision === null` row is the migration path. Every existing install
sees the notice exactly once; reloading records a revision and it never returns.
For this user right now that verdict is literally correct — her Brunella is
missing the grimoire. A user whose sheet happens to be current pays one
unnecessary reload, which is why the reload is safe to make cheap and why this
is preferable to silently assuming everyone is up to date.

### 5. The UI (`src/components/HeaderStatus.tsx`)

A button rendered only when `libraryUpdateAvailable(...)` is true, placed before
the sync group:

- Icon `menu_book`, label `Ficha` (`hidden md:inline`, matching the existing
  buttons).
- Styled like the primary-accented "Actualizar" button, **not** like the neutral
  `SyncButton`s — it is a different axis of staleness and must not read as a
  third sync action sitting next to Guardar/Traer.
- `title` / `aria-label`: `"Hay una versión nueva de la ficha en la librería —
  recargar (se pierde el estado de la sesión)"`. Spanish, matching the rest of
  the header.
- While `checking` is true after a tap, the button shows the spinning `sync`
  icon and is disabled, so a slow network cannot produce a double reload.

## Data model impact

- `public/characters/manifest.json`: `revision` on each entry (committed).
- `src/types/characterLibrary.ts`: `CharacterSummary.revision?: string`.
- `src/store/character.ts`: `libraryRevision`, persist v5 → v6 + migrate.

## API impact

None. The library is static files; no `api/` route changes, no Upstash changes.

## Frontend impact

`HeaderStatus.tsx` (new button), `main.tsx` (check wiring), plus the new store
and pure-flags module. `LibraryPicker` needs one change: it already calls
`loadCharacter(character, { sourceId: s.id })` and must now pass
`revision: s.revision ?? null` so picking a character from Ajustes records the
revision and does not immediately trigger the notice.

## Observability impact

`lastError` on the library store, surfaced only as the button's `title` if a
reload fails. No new telemetry — this app has none.

## Security impact

None. Same-origin fetches of already-public static assets, no new inputs, no
new persisted secrets.

## Accessibility considerations

The button is a real `<button>` with an `aria-label` that states both the
purpose and the consequence. It joins the existing `role="status"` region's
neighbourhood but stays outside it — it is an action, not a status. Disabled
state during reload is conveyed by `disabled`, not colour alone.

## Performance considerations

One extra `fetch` of a ~300-byte manifest, sharing the existing 5-second
throttle and firing on the same boot/focus/online events as the sync check. No
new render work: the button is absent from the tree unless an update is pending.

## Acceptance criteria

1. Editing `public/characters/brunella.json` and running `npm run library:stamp`
   changes only Brunella's `revision` in the manifest.
2. Re-serialising a character JSON (key reorder, whitespace) does **not** change
   its revision.
3. `node scripts/stampLibrary.mjs --check` exits non-zero on a stale manifest and
   zero on a fresh one; a test asserts the committed manifest is fresh.
4. Picking a character in Ajustes records `libraryRevision`, and no notice
   appears afterwards.
5. With a library character loaded and the manifest advertising a different
   revision, the header shows the "Ficha" button; tapping it replaces the sheet
   and the button disappears.
6. A `custom` or `sample` character never shows the button.
7. An install upgrading from persist v5 keeps its character and sees the button
   once; one reload clears it permanently.
8. A failed manifest fetch shows no button and no error adornment.
9. Cloud sync's flags, buttons and behaviour are unchanged.

## Risks

- **Destructive reload, one tap, in the header.** Accepted in the brainstorm.
  Mitigated by the button existing only while an update is pending and by its
  distinct styling and consequence-stating label. Worth revisiting if it ever
  costs a mid-session HP total.
- **The one-time notice after migration** will also fire for anyone whose sheet
  is already current. Accepted: self-healing, single occurrence, and the
  alternative (assume current) hides exactly the bug this feature exists to fix.
- **A reload changes durable fields**, so the existing auto-push subscription
  will queue an Upstash push afterwards. That is correct — the reloaded sheet is
  the intended truth — and is existing behaviour, not a change.
- **`prebuild` writes into `public/`** during CI. Deterministic, and the guard
  test means the written result should equal the committed one.

## Open questions

None.
