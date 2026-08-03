# Library update notice — design

**Date:** 2026-08-02
**Status:** approved (brainstorm), revised after adversarial review
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
- Show a "Ficha" button in the header when the stored and advertised revisions
  differ, **or when the stored revision is unknown**; tapping it reloads the
  character from the library.

## Out of scope

- **Merging.** Reloading stays destructive — the library version replaces the
  sheet wholesale, exactly as it does today (decided in brainstorm). Preserving
  session state across a reload is a separate, larger feature.
- **A confirmation dialog.** Decided in brainstorm: the reload is one tap. The
  mitigation is that the button only exists while an update is pending, so there
  is nothing to mis-tap the rest of the time.
- Notifying about library characters you are *not* currently playing.
- Any change to the Upstash sync path, its flags, or its buttons.
- **Adding CI.** This repo has no `.github/workflows/`. Running the guard test
  automatically is a good idea and a separate decision; see Risks.

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

**The digest is taken over the parsed JSON, never over the file bytes.** The
script does `sha256(stableStringify(JSON.parse(bytes)))`, truncated to 12 hex
characters, where `stableStringify` sorts object keys. This is not a stylistic
choice: `git ls-files --eol public/characters/` reports `i/lf w/crlf` and this
machine has `core.autocrlf=true`, so the working tree is CRLF while git's index
and Vercel's checkout are LF. A byte-level digest would produce different
revisions locally and on Vercel, turning the guard test red immediately after a
green deploy. Parsing first also means reformatting or reordering keys does not
read as a change.

`node:crypto`'s `createHash("sha256")` is used rather than the hand-rolled hash
in `src/lib/syncFlags.ts`. That one is hand-rolled to keep the client bundle
small; these scripts are Node-only and never ship, so the trade-off does not
apply.

Two plain-ESM node scripts, so they run with no build step:

- `scripts/libraryDigest.mjs` — `stableStringify` + `digestCharacter`, nothing else.
- `scripts/stampLibrary.mjs` — reads the manifest, digests each
  `public/characters/<id>.json`, writes the revisions back. With `--check` it
  writes nothing and exits `1` if any revision is stale or missing. `--check`
  **compares parsed `revision` values only** — never regenerated file text,
  which would always differ on Windows because `JSON.stringify` emits `\n`.

The script re-serialises the manifest with `JSON.stringify(manifest, null, 2)`
plus a trailing newline, matching the file's current formatting, so stamping an
already-fresh manifest is a no-op diff.

Wiring in `package.json`:

- `"library:stamp": "node scripts/stampLibrary.mjs"` — run it by hand.
- `"build": "node scripts/stampLibrary.mjs && tsc -b && vite build"`.

The stamp goes **inside `build`, not in a `prebuild` hook**: `prebuild` only
fires for `npm run build`, and Vercel's Build Command is a dashboard setting this
repo cannot assert. Folding it into the script itself makes the guarantee
independent of how the build is invoked.

**Source of truth:** the script is authoritative; the committed manifest is a
convenience so `npm run dev` sees correct revisions. The guard test is what keeps
the two equal. Note the consequence: because the build re-stamps, a commit with a
stale manifest still deploys *internally consistent* — the deployed manifest and
the deployed JSONs agree — so the mistake never reaches users and surfaces only
as a red local test. That is the intended failure mode, not an accident.

**The app never computes a digest.** At runtime it only compares two strings.

### 2. Remembering what you loaded

`CharacterSummary` (`src/types/characterLibrary.ts`) gains `revision?: string`.
No change is needed in `fetchLibraryManifest`: its `.filter()` is a type
predicate that returns the original objects untouched, so extra fields already
flow through — only the type has to admit the field. The manifest envelope
`version` stays at `1`: the change is additive and older clients ignore it.

`CharacterState` gains:

```ts
/**
 * Revision of the library entry this character was loaded from. `null` when the
 * character did not come from the library, or came from a build that predates
 * revisions.
 */
libraryRevision: string | null;
```

`loadCharacter`'s options widen to `{ sourceId: string | null; revision?: string | null }`
— **`sourceId` stays required whenever `opts` is passed.** Today the store
decides the origin by key presence (`opts && "sourceId" in opts ? ... : "custom"`),
so an optional `sourceId` would let `loadCharacter(c, { revision })` typecheck
and silently mark a library character as `"custom"`. Keeping it required closes
that hole at the type level.

The Settings import path (`loadCharacter(parsed)`, no opts) must clear
`libraryRevision` to `null` alongside `activeCharacterId = "custom"`.
`resetToSample()` clears it too.

Persist store `arcanist-ledger:character` goes **v5 → v6** per the CLAUDE.md
convention. The migrate is a pass-through for v5: zustand's default merge is
`{...currentState, ...persistedState}`, so an absent `libraryRevision` already
resolves to the initial `null` with no migrate involvement. The migrate must
**not** reconstruct the state object — doing so risks dropping
`activeCharacterId`.

### 3. The check (`src/store/library.ts`)

A new, small store — deliberately separate from `useSync`:

```ts
interface LibraryState {
  /** Revision the manifest advertises for the ACTIVE character. */
  availableRevision: string | null;
  /** A background manifest check is in flight. Does NOT disable the button. */
  checking: boolean;
  /** A user-initiated reload is in flight. Disables the button. */
  reloading: boolean;
  lastError: string | null;
  check: () => Promise<void>;
  reload: () => Promise<void>;
}
```

Separate because the library check must work with cloud sync switched off —
`checkRemote` returns early on `!isSyncEnabled()` (`sync.ts:127`), and folding
the library into it would either break that guarantee or tangle two independent
staleness axes.

`check()` no-ops unless the active character came from the library, then fetches
the manifest. **A successful check always writes `availableRevision`** —
`entry?.revision ?? null`, so a character removed from the manifest clears the
notice instead of pinning a revision forever. Only network/HTTP failures leave it
untouched and set `lastError`: a failed check must never look like "you are up to
date" *or* like "there is an update".

`reload()`:

1. Refuses if `reloading` is already true.
2. Fetches **the manifest and the character together**, and records the revision
   from *that* manifest read. It must not use the stored `availableRevision`:
   `check()` fires on `focus`/`online`, both trivially reachable while the
   character fetch is awaiting, so a deploy landing mid-reload would stamp the
   new revision onto the old content and silence the notice permanently — the
   exact bug this feature exists to kill.
3. Applies the load inside `withHydration(...)` (see below), then calls
   `useSync.getState().recompute()`.

**Auto-push is suppressed for a library reload.** `useCharacter.subscribe`
(`sync.ts:257`) would otherwise schedule a `pushNow` 1500 ms later, pushing the
library's values over every *other* device's synced edits on the strength of one
unconfirmed tap. A library reload is not a user edit, and this app's rule is that
uploads are explicit. So `sync.ts` exports

```ts
export function withHydration<T>(fn: () => T): T;
```

which sets the existing module-private `hydrating` flag around a **synchronous**
apply. The subsequent `recompute()` still updates the flags, so if the reload
changed durable fields the header simply offers **Guardar** and the user decides.

Worth recording, because it inverts the naive expectation: `extractDurable`
(`durableSheet.ts:29-40`) covers only `abilities / hpMax / ac / armor / party /
level / proficiencyBonus / narrationPrompt`. The motivating change — an item
granting rituals, i.e. `resources` + `innateSpells` — touches none of them, so
that reload produces no dirty flag and nothing to push at all.

**Ordering against `pullNow`** is deliberately left as last-writer-wins rather
than mutexed. Both applies are synchronous, so they cannot interleave; and if a
pull lands durable fields on top of a freshly reloaded sheet, the result is
exactly the conflict state the header already models (Guardar + Traer both
offered, user decides). Adding a mutex would buy a rarer race a worse UX.

`src/main.tsx` calls `check()` from the existing throttled `maybeCheck()`
(boot / `focus` / `online`) and clears `availableRevision` in the existing
`activeCharacterId` subscription, for the same reason sync clears
`remoteUpdatedAt` there: the seen revision describes the wrong character.

### 4. The decision (`src/lib/libraryFlags.ts`)

Pure, so it is testable without the store or the header — the same split that
`syncFlags.ts` exists for (the header imports the SW store, which cannot run
under Vitest).

```ts
export type LibraryNotice = "none" | "update" | "unknown";

export function libraryNotice(a: {
  activeCharacterId: string | null;
  loadedRevision: string | null;
  availableRevision: string | null;
  appUpdatePending: boolean;
}): LibraryNotice;
```

| Case | Result | Why |
|---|---|---|
| `appUpdatePending` | `"none"` | See below — the app update always wins |
| `activeCharacterId` is `null`, `"sample"` or `"custom"` | `"none"` | Not a library character |
| `availableRevision === null` | `"none"` | Never checked, offline, entry gone, or a manifest predating revisions — silence beats a wrong claim |
| `loadedRevision === null` | `"unknown"` | Unknown origin revision ⇒ assume stale |
| `loadedRevision !== availableRevision` | `"update"` | Plain comparison |
| otherwise | `"none"` | |

**`appUpdatePending` wins** because the motivating incident is precisely the
collision: PR #23 shipped app code *and* `brunella.json` in one deploy. The
manifest is fetched live even on a stale bundle (see the PWA note below), so a
device would show "Ficha" next to the existing "Actualizar" — two primary-accented
icon chips, labels hidden on a phone. Tapping Ficha first reloads the sheet under
the old bundle, the grimoire still does not render, and the reload looks broken.
Update the app first; the notice reappears afterwards if it is still warranted.

**`"unknown"` is the migration path.** Every existing install sees the notice
exactly once; reloading records a revision and it never returns. For this user
right now that verdict is literally correct — her Brunella is missing the
grimoire. A user whose sheet happens to be current pays one unnecessary reload,
which is why the reload is safe to make cheap, and why this beats silently
assuming everyone is current — that assumption hides exactly the bug the feature
exists to fix.

`"unknown"` and `"update"` are distinguished **only** so the button can tell the
truth in its label. The app does not know a newer version exists in the unknown
case, and must not claim it.

### 5. The UI (`src/components/HeaderStatus.tsx`)

A button rendered only when `libraryNotice(...) !== "none"`, placed before the
sync group:

- Icon `menu_book`, label `Ficha` (`hidden md:inline`, matching the existing
  buttons).
- Styled like the primary-accented "Actualizar" button, **not** like the neutral
  `SyncButton`s — it is a different axis of staleness and must not read as a
  third sync action sitting beside Guardar/Traer.
- `title` / `aria-label`, in Spanish, matching the rest of the header:
  - `"update"` → `"Hay una versión nueva de la ficha en la librería — recargar (se pierde el estado de la sesión)"`
  - `"unknown"` → `"No sé de qué versión viene esta ficha — recargar desde la librería (se pierde el estado de la sesión)"`
- While `reloading` is true the button is `disabled` and shows a spinning
  `progress_activity` icon — **not** `sync`, which is what the header renders for
  `sync.kind === "busy"` and would undo the whole point of the distinct styling.
  A background `check()` must never disable the button.

The Ajustes → Library section gains one line surfacing `lastError` when the last
manifest check failed, so a persistently failing check is discoverable somewhere
instead of being silent forever.

## Data model impact

- `public/characters/manifest.json`: `revision` on each entry (committed).
- `src/types/characterLibrary.ts`: `CharacterSummary.revision?: string`.
- `src/store/character.ts`: `libraryRevision`, persist v5 → v6 + pass-through migrate.

## API impact

None. The library is static files; no `api/` route changes, no Upstash changes.

## Frontend impact

`HeaderStatus.tsx` (new button), `main.tsx` (check wiring), `Settings.tsx` (error
line), `sync.ts` (export `withHydration`), plus the new store and pure-flags
module. `LibraryPicker` already calls `loadCharacter(character, { sourceId: s.id })`
and must now also pass `revision: s.revision ?? null`, so picking a character in
Ajustes records the revision instead of immediately triggering the notice.

## PWA note (an invariant to preserve)

`vite.config.ts`'s workbox `globPatterns` excludes `json`, there is no
same-origin `runtimeCaching` entry, and the library fetches use
`cache: "no-cache"`. That is *why* this feature works on a stale bundle: the
manifest is always read live. Adding `json` to `globPatterns` later would freeze
the manifest at build time and make the notice permanently wrong. A comment goes
in `vite.config.ts` next to `globPatterns` saying so.

## Observability impact

`lastError` on the library store, surfaced in Ajustes → Library and, on a failed
reload, in the button's `title`. No new telemetry — this app has none.

## Security impact

None. Same-origin fetches of already-public static assets, no new inputs, no new
persisted secrets.

## Accessibility considerations

A real `<button>` whose `aria-label` states both the purpose and the consequence,
and which tells the truth in the `"unknown"` case rather than asserting a newer
version exists. It sits outside the existing `role="status"` region: it is an
action, not a status. The reloading state is conveyed by `disabled`, not colour.

## Performance considerations

One extra `fetch` of a ~400-byte manifest, sharing the existing 5-second throttle
and the same boot/focus/online events as the sync check. No new render work: the
button is absent from the tree unless a notice is pending.

## Acceptance criteria

1. Editing `public/characters/brunella.json` and running `npm run library:stamp`
   changes only Brunella's `revision`, and re-running it is a no-op diff.
2. Re-serialising a character JSON (key reorder, whitespace, CRLF↔LF) does **not**
   change its revision.
3. `node scripts/stampLibrary.mjs --check` exits non-zero on a stale or unstamped
   manifest and zero on a fresh one; a test shells out to it via
   `execFileSync(process.execPath, [...])` — no shell, Windows-safe — and asserts
   the committed manifest is fresh.
4. Picking a character in Ajustes records `libraryRevision`, and no notice appears
   afterwards.
5. With a library character loaded and the manifest advertising a different
   revision, the header shows the "Ficha" button; tapping it replaces the sheet
   and the button disappears.
6. A `custom` or `sample` character never shows the button, and neither does a
   character with no active id.
7. An install upgrading from persist v5 keeps its character and its
   `activeCharacterId`, and sees the notice once with the `"unknown"` wording; one
   reload clears it permanently.
8. A failed manifest fetch shows no button and no error adornment in the header,
   and does not overwrite a previously seen revision.
9. While `needRefresh` is true, the Ficha button is not rendered.
10. A reload records the revision from the manifest it fetched itself, not from a
    concurrently updated `availableRevision`.
11. A library reload schedules no Upstash push; if it changed durable fields the
    header offers Guardar instead.
12. Cloud sync's flags, buttons and behaviour are otherwise unchanged.

## Risks

- **Destructive reload, one tap, in the header.** Accepted in the brainstorm.
  Mitigated by the button existing only while a notice is pending, by its distinct
  styling, and by a label that states the consequence. Worth revisiting if it ever
  costs a mid-session HP total.
- **The one-time notice after migration** also fires for anyone whose sheet is
  already current. Accepted: self-healing, single occurrence, honest wording.
- **No CI runs the guard test.** There is no `.github/workflows/`, so "enforced by
  a test" means "enforced when someone runs `npm test`". The stamp inside `build`
  is what actually protects production. Adding a workflow is out of scope here and
  worth doing separately.
- **`loadCharacter`'s key-presence idiom** for deciding `"custom"` is fragile.
  Required `sourceId` closes the new hole, and this change adds the first tests
  that pin `activeCharacterId` behaviour at all.

## Revisions after adversarial review

Applied: the `reload()` race (§3.2), the guard test's inability to import the
script (§AC3), the Ficha/Actualizar collision (§4), the false "stops discarding"
claim (§2), the auto-push consequence and its suppression (§3), separate
`reloading` flag and non-`sync` spinner (§3, §5), honest `"unknown"` wording
(§4, §5), `availableRevision` cleared on a successful no-match check (§3),
parsed-JSON digest and CRLF reasoning (§1), stamp moved into `build` (§1),
source-of-truth statement (§1), corrected migrate rationale (§2), required
`sourceId` (§2), `lastError` surfaced in Ajustes (§5), PWA invariant recorded
(§PWA note), `node:crypto` (§1), manifest serialisation pinned (§1).

Not applied: adding a GitHub Actions workflow — real, but a separate decision,
recorded under Risks. A mutex between `reload()` and `pullNow()` — the applies
are synchronous and cannot interleave, and the surviving ordering question is
already modelled by the existing conflict state; a mutex would trade a rare race
for a worse UX.
