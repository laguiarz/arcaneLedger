# Design — Version and sync state in the header

Date: 2026-08-01
Status: **revised after an adversarial review that invalidated the first version's core.**
See "Revisions after review" at the end.

## Problem

Two failures this session share one root cause: **the app never showed the user what state
it was in.**

1. A tablet ran a stale build for days with no visible signal.
2. Max HP was set to 28 on the tablet; the laptop and the server both hold 33; the server's
   stored `updatedAt` has not advanced. The tablet showed a green "Sincronizado"
   throughout. The 28 never left the device.

### What is actually proven, and what is not

**Proven against production:** `api/sync.ts` returns `{ok:true}` for a write it discards. A
PUT carrying `updatedAt: 1` and `hpMax: 999` answered `{"ok":true}` and changed nothing.
The client therefore shows a green tick for a write that never happened.

**Disproven — an earlier draft of this spec claimed it:** that `setLastSynced` pushes the
watermark *above* the server's stamp and makes `remote.updatedAt > watermark` false
forever. It cannot. `setLastSynced` stores the same stamp the server just compared; had it
been higher, the server's `>=` guard would have **accepted** it. When the server discards,
the watermark ends up *below* the stored stamp, which makes the next pull more likely, not
less.

**Still unknown:** why the tablet's 28 never reached the server. Candidates not yet
separated: sync disabled on that device, a clock behind the server's stored stamp, or a
push that never happened. Diagnosing it needs `al.sync.lastSynced` and `al.sync.enabled`
from the tablet.

**This design therefore does not depend on knowing the answer.** Every mechanism below is
chosen so the tablet's 28 is recoverable regardless of which candidate is true.

## Goals

- The running build is visible on every screen, without opening Settings.
- A new build can be applied from anywhere.
- The header always shows whether local and cloud agree, and offers **both** directions
  when they do not.
- **No device clock is ever trusted for ordering.**
- Sync never silently overwrites either side, and never reports a success that did not
  happen.

## Non-goals

- Field-level merge. Whole-blob stays; the fix is to stop lying and to hand the decision to
  the user.
- Real-time sync between open devices.
- Reworking the Cloud sync secret/enable UI beyond repointing its button.

## Part 1 — Version in the header

`formatVersion()` and the build constants already exist (`src/lib/appVersion.ts`).

**Placement.** The brand is in the **sidebar** on desktop and disappears when it is
collapsed; the topbar shows it only on mobile. So the version goes in the **topbar left
slot on every breakpoint** — under the brand on mobile, and in the currently empty
`hidden md:block` spacer (`AppShell.tsx:157`) on desktop. It is in `AppShell`, so it is on
every page.

Small and muted (`text-[10px] text-outline font-mono`). It is **not** a link: `AboutPanel`
sits at the bottom of a long Settings page with no anchor, so "opens Settings → Acerca de"
would strand the user at the top. Dropped.

**Update affordance.** When `needRefresh` is true, a compact `Actualizar` button replaces
the version line in the same slot. The floating `UpdateBar` is deleted — one affordance,
not two. Nothing else depends on it.

**Mobile layout.** The topbar already packs brand + HP + slots + conditions pills + rest
button into `h-14`. The version line and the sync controls must be verified at narrow
widths before claiming "every breakpoint"; sync controls are icon-only below `md`.

## Part 2 — Optimistic concurrency, so no clock is trusted

The current guard compares `body.state.updatedAt` against the stored stamp — two different
device clocks. That is the root of both the silent discard and the "which side is newer"
question. Replace it with **compare-and-set on the stamp the client last saw**:

**Request:** `PUT /api/sync?characterId=… { state, baseUpdatedAt, force? }`
- `baseUpdatedAt` — the `updatedAt` this client last successfully applied or wrote; `null`
  if it has never synced.

**Server:**
- Writes when `!existing || baseUpdatedAt === existing.updatedAt || force === true`.
- **The server stamps `updatedAt` itself** (`Date.now()` on the server). Client clocks stop
  participating in ordering entirely.
- Responds `{ ok: true, applied: boolean, updatedAt: number }` where `updatedAt` is the
  stamp now stored — the new value on success, the unchanged existing one on rejection.

**`force`** exists so a user who has seen the conflict and pressed Guardar can always win.
Without it there is no path that gets the tablet's 28 to a server holding a newer blob —
the first draft had exactly that dead end.

**Combat records** are unaffected: immutable, union-merged, idempotent by id. They keep
their own branch of the handler and are always appended. `applied` describes the **state**
blob only, and is **omitted** when the request carried no `state`.

**Backward compatibility runs the other way from the first draft's claim.** An old client
against the new server is fine (it ignores the body). A **new client against an older
deployment** gets `{ok:true}` with no `applied` field: `applied === undefined` MUST be
treated as "legacy server, assume applied", never as failure.

## Part 3 — Sync state in the header

### `dirty` is content-based, never timestamp-based

A new `localChangedAt` stamp would be wrong twice over:

- On the tablet it does not exist yet, so `dirty` would be **false** and the header would
  offer only Traer — destroying the 28 it is meant to rescue.
- The existing `useCharacter`/`useCoin` subscriptions fire on **every** store write,
  including volatile session state that is deliberately not synced — `takeDamage`, `heal`,
  `useResource`, `toggleCondition`. One combat round would light Guardar permanently and
  the indicator would be noise.

Instead the store persists `al.sync.baseline`: a digest of the durable payload as of the
last **confirmed** write or apply, i.e. of `{ sheet: extractDurable(character), coin: purseFor(coin, cid) }`.

```ts
/** Stable JSON digest of the durable payload. Pure, exported, testable. */
export function digestState(payload: unknown): string;

/** Pure. `baseline === null` means "never confirmed" → pessimistically dirty. */
export function syncFlags(args: {
  baseline: string | null;
  current: string;
  lastAppliedUpdatedAt: number | null;
  remoteUpdatedAt: number | null;
  enabled: boolean;
}): { dirty: boolean; remoteAhead: boolean };
```

- `dirty` = `enabled && (baseline === null || baseline !== current)`.
- `remoteAhead` = `enabled && remoteUpdatedAt !== null && remoteUpdatedAt !== lastAppliedUpdatedAt`.

`remoteAhead` compares a server-issued stamp against the server-issued stamp this device
last applied — an equality test between two values from **one** clock, not an ordering
test across devices.

**This is what recovers the tablet:** it has no `baseline`, so `dirty` is true on the first
load of this build and **Guardar is offered**, with `force` behind it. No stamp archaeology
required, and it holds whichever root-cause candidate turns out to be true.

### Header states

| State | Shown |
|---|---|
| sync disabled, or no active character | version only — no sync region at all |
| in sync | quiet check icon, no action |
| `dirty` only | **↑ Guardar** |
| `remoteAhead` only | **↓ Traer** |
| both | warning icon plus **both** buttons |
| in flight / error | spinner, or error icon with the message in its `title` |

The affordance is driven by the flags; `status` only drives the spinner and the error
adornment. They are orthogonal — `status` is global and `pushCombat` mutates it too, so it
must never decide which button shows.

A conflict is **not** an error: `SyncStatus` gains `"conflict"` rather than reusing
`"error"`, which `CloudSyncSettings` renders as a red failure.

A second pure function maps everything to what renders, so it is testable without a DOM
(the header imports `useSwUpdate`, which imports `virtual:pwa-register` and cannot run
under Vitest):

```ts
export type HeaderSync =
  | { kind: "hidden" }
  | { kind: "synced" }
  | { kind: "save" }
  | { kind: "fetch" }
  | { kind: "conflict" }
  | { kind: "busy" }
  | { kind: "error"; message: string };

export function syncHeaderState(args: {…}): HeaderSync;
```

### What is automatic and what is not

- **Automatic — check only:** `checkRemote()` on boot, focus, online, **and whenever
  `activeCharacterId` changes**, throttled. It records `remoteUpdatedAt` and applies
  nothing to the character or coin stores. It is skipped entirely while
  `activeCharacterId === null` (the first-run state), because `activeCid()` would otherwise
  report on `char:custom:state` and the header would describe the wrong key. Switching
  characters clears `remoteUpdatedAt` first.
- **Automatic — combats still merge.** `checkRemote` performs the same GET the pull does
  and it already returns the combats array. They are immutable and union-merged, so
  applying them can lose nothing; the Chronicle must not go stale. `pushCombat` likewise
  stays automatic. This is stated explicitly so "nothing moves on its own" is not read as
  covering combats.
- **Automatic — push only when there is no conflict.** The debounced push is kept **while
  `remoteAhead` is false**: there is nothing to lose a race with, the server now stamps and
  compare-and-sets, and removing it entirely would trade silent-wrong-success for
  silent-no-backup. When `remoteAhead` is true the debounce stops and the user resolves it.
- **Manual:** `pullNow()` ("Traer") applies the remote blob and sets baseline and
  `lastAppliedUpdatedAt` to what it applied. `pushNow()` ("Guardar") sends `force: true`
  and, only on `applied !== false`, sets baseline to what it sent and
  `lastAppliedUpdatedAt` to the server's returned stamp.

`syncNow()` (pull-then-push) is **deleted**; it can overwrite the local edit it was meant
to upload. `CloudSyncSettings`'s button becomes "Comprobar" → `checkRemote()`.

### `hydrating` discipline

`pullNow` wraps its applies in `hydrating = true` with `try/finally`, exactly as `pull()`
does today, so applying remote data does not echo back as a local change. After a
successful apply it sets `baseline = digestState(applied)`, so the header does not flip to
**Guardar** the instant Traer finishes.

`checkRemote` must **not** touch `hydrating` — it applies no state, and its `finally` could
otherwise clear the flag in the middle of a concurrent `pullNow`. Ownership stays with
`pullNow`.

## Testing

Pure and store-level only (no RTL, no jsdom; Vitest runs in `node`):

- `digestState` — stable across key order, different for different payloads.
- `syncFlags` — null baseline is dirty; equal digests are clean; `remoteAhead` on stamp
  mismatch; everything false when `enabled` is false.
- `syncHeaderState` — every branch, especially both-flags → `conflict`.
- `pushNow` sets baseline only when `applied !== false`, and treats `applied: undefined`
  (legacy server) as applied.
- `checkRemote` records `remoteUpdatedAt`, merges combats, and leaves the character and
  coin stores untouched.
- Tests must `vi.mock("@/lib/syncConfig")` the way `src/lib/syncApi.test.ts` already does —
  `isSyncEnabled()` reads `localStorage`, which is absent under node, so an unmocked test
  would pass vacuously with every action returning at its first line.

ACs 1-5 and 9 are **manual** verification; only 6-8 are covered by automated tests.
Browser checks run with sync disabled in that profile first.

## Acceptance criteria

1. (manual) The version is visible in the header on every page and every breakpoint.
2. (manual) With a newer build deployed, `Actualizar` appears in the header on any page.
3. (manual) With unsaved local changes, the header offers **Guardar**; pressing it makes
   the server's stored `updatedAt` advance and the button clear.
4. (manual) With the server ahead, the header offers **Traer**; pressing it applies.
5. (manual) When both hold, both buttons appear and nothing is applied until the user
   chooses.
6. A PUT the server refuses returns `applied: false` and produces a conflict state, never a
   success tick — and never advances the baseline.
7. `force: true` writes even when `baseUpdatedAt` does not match, and the server's own
   clock supplies the stored `updatedAt`.
8. A device with no baseline reports `dirty` and is offered **Guardar**.
9. (manual) With sync disabled the header shows the version only.
10. `npm test` and `npm run build` stay green.

## Revisions after review

The first version of this spec was reviewed by an adversarial critic and **its core was
wrong**. Changes:

- **The recovery story was inverted.** A new `localChangedAt` key would be null on the
  tablet, making `dirty` false, offering only Traer, and destroying the 28. `dirty` is now
  content-based with a null baseline meaning "pessimistically dirty".
- **There was no path to upload at all** once the server held a newer blob — Guardar would
  have been discarded and the user told to press Traer, which deletes the data. Hence
  `force`, and server-side stamping.
- **The stated root cause was self-contradictory** (see "What is actually proven"). The
  claim is retracted and the design no longer depends on it.
- **`dirty` would have been permanently true** because the subscriptions fire on volatile
  session state. Content digest fixes this too.
- **Combat records would have silently stopped arriving** once automatic apply was removed.
  They now keep merging in `checkRemote`, and `pushCombat` stays automatic, stated
  explicitly.
- **`applied` semantics** are defined for the combat-only branch, and
  `applied === undefined` means legacy-server-assume-applied.
- Added: re-check on character switch and the `activeCharacterId === null` skip; the
  sync-disabled state; `"conflict"` as a distinct status; the `hydrating` ownership rule;
  the `syncHeaderState` seam; the `vi.mock("@/lib/syncConfig")` requirement; ACs marked
  manual vs automated.
- Dropped: the version line as a link to Settings (no anchor exists), and the claim that
  `checkRemote` is "lightweight" (it is the same full GET).

Two departures from the critic, deliberate: the debounced auto-push is **kept while there
is no conflict** rather than removed, because removing it trades a visible wrong-success
for an invisible no-backup; and the server's non-atomic read-then-write is left as-is and
recorded as a known limitation, since a single-user app does not race with itself and Lua
scripting is disproportionate here.
