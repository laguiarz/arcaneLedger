# Design — Version and sync state in the header

Date: 2026-08-01
Status: design agreed inline with the user; written before the critic pass.

## Problem

Two failures this session share one root cause: **the app never showed the user what
state it was in.**

1. A tablet ran a stale build for days with no visible signal.
2. Max HP was set to 28 on the tablet, 33 stayed on the laptop, and the server holds 33.
   The tablet reported a green "Sincronizado" the whole time. The 28 never left the
   device and the user had no way to know.

Two defects behind #2, both **verified against production**, not theorised:

- **The server reports success for a write it discarded.** `api/sync.ts` only writes when
  `body.state.updatedAt >= existing.updatedAt`, but returns `{ok:true}` either way. A PUT
  with an old stamp and `hpMax: 999` returned `{"ok":true}` and changed nothing.
- **The watermark poisons itself.** `pushStateNow()` calls `setLastSynced(state.updatedAt)`
  as soon as `putState` resolves, whether or not the server applied it. Once the local
  watermark passes the server's stored `updatedAt`, the pull guard
  `remote.updatedAt > watermark` is false forever, so that device silently ignores the
  server from then on. Permanently, with no error.

A third design flaw makes recovery worse: `syncNow()` **pulls before it pushes**. With a
newer blob on the server, pressing "Sincronizar ahora" overwrites the local edit before it
is ever uploaded — the button destroys the very change the user is trying to save.

## Goals

- The running build is visible on every screen, without opening Settings.
- A new build can be applied from anywhere, not just Settings.
- The header always shows whether local data and cloud data agree, and when they do not,
  offers **both** directions explicitly.
- Sync never silently overwrites either side.

## Non-goals

- Field-level merge. Sync stays whole-blob; the fix is to stop lying about it and to put
  the decision in the user's hands.
- Real-time sync between open devices. Checks happen on open, focus and reconnect.
- Reworking Settings → Cloud sync (secret, enable toggle) beyond repointing its button.

## Part 1 — Version in the header

`formatVersion()` and the build constants already exist (`src/lib/appVersion.ts`).

**Placement.** The layout complicates "under Arcanist's Ledger": the brand is in the
**sidebar** on desktop (and vanishes when collapsed), and in the **topbar** only on mobile.
So the version goes in the **topbar left slot, on every breakpoint** — under the brand on
mobile, and alone in the slot that is currently an empty spacer on desktop. It is present
on every page because the topbar is part of `AppShell`.

Rendered small and muted (`text-[10px] text-outline font-mono`), and it is a **button**:
pressing it opens Settings → Acerca de. Cheap discoverability, no new route.

**Update affordance.** When `needRefresh` is true the version line is replaced by a compact
`Actualizar` button in the same slot, styled as a call to action. The existing floating
`UpdateBar` is removed — one affordance, not two.

## Part 2 — Sync state in the header

### The three facts the UI needs

| Fact | Where it comes from |
|---|---|
| `lastSynced` | `al.sync.lastSynced`, already exists — but only advances on a **confirmed** apply after this change |
| `localChangedAt` | new: `al.sync.localChangedAt`, stamped by the existing `useCharacter` / `useCoin` subscriptions |
| `remoteUpdatedAt` | new: fetched by a lightweight check that does **not** apply anything |

Derived, in the sync store:

- `dirty` = `localChangedAt > (lastSynced ?? 0)` — local has unsaved changes.
- `remoteAhead` = `remoteUpdatedAt > (lastSynced ?? 0)` — the cloud has something this
  device has not taken.

### Header states

| State | Shown |
|---|---|
| in sync | a quiet check icon, no action |
| `dirty` only | **↑ Guardar** |
| `remoteAhead` only | **↓ Traer** |
| both | a warning icon plus **both** buttons |
| syncing / error / offline | spinner, or an error icon whose title carries the message |

Icon-only on mobile, icon + label from `md` up. Every control has an `aria-label`; the
region is a `role="status"` so a screen reader announces changes.

### Behaviour change: automatic apply is removed

Today boot / focus / online call `pull()`, which **applies** the remote blob. That is what
can eat a local edit, and the user's explicit instruction is that sync must never decide on
its own. After this change:

- **Automatic:** `checkRemote()` only — a GET that records `remoteUpdatedAt` and applies
  nothing. Runs on boot, focus and online, throttled as `maybePull` is today.
- **Manual:** `pullNow()` ("Traer") applies the remote blob unconditionally, then sets the
  watermark to the applied `updatedAt`. `pushNow()` ("Guardar") uploads and sets the
  watermark **only if the server confirms it applied**.

Automatic *push* is removed for the same reason: a background push is what let the tablet
believe it was saved. Data now goes up when the user presses Guardar, and the header says
so continuously — which is the point of the feature.

### Server change

`api/sync.ts` PUT returns what it actually did:

```ts
res.status(200).json({ ok: true, applied, remoteUpdatedAt });
```

- `applied` — whether the state blob was written.
- `remoteUpdatedAt` — the stamp now stored, so a rejected client can update its view and
  show **↓ Traer** instead of pretending it saved.

The response stays additive; older clients ignore the new fields.

`putState()` returns the parsed body instead of `void`, and `pushNow()` branches on
`applied`. When `applied` is false the store sets `status: "error"` with a plain message —
"El servidor tiene una versión más nueva. Usá Traer." — rather than a green tick.

### Recovering the tablet

This is what makes the user's current situation recoverable: the tablet still holds the
only copy of `hpMax: 28`. With the header live, that device will show **↑ Guardar** —
because its `localChangedAt` is newer than its `lastSynced` — and pressing it uploads 28
with a fresh stamp, which the server accepts. If instead the tablet shows only **↓ Traer**,
its watermark is already poisoned; the spec's watermark fix stops it getting worse, and
the user can still force the upload with Guardar, which is always offered when `dirty`.

## Testing

Pure logic and store tests only, per the project convention (no RTL, no jsdom):

- `syncFlags(lastSynced, localChangedAt, remoteUpdatedAt)` — a **pure exported function**
  returning `{ dirty, remoteAhead }`, covering: nothing synced yet, local newer, remote
  newer, both, and equal stamps. The header renders from this, so the interesting logic is
  testable without a DOM.
- `pushNow` does **not** advance the watermark when the server replies `applied: false`,
  and does when it replies `applied: true` (fetch stubbed).
- `checkRemote` records `remoteUpdatedAt` and leaves the character and coin stores
  untouched.
- Existing sync tests keep passing.

Manual verification in a browser, **with sync disabled in that profile first**, plus a
real two-device check against production, which is the one thing unit tests cannot cover.

## Acceptance criteria

1. The version is visible in the header on every page, at every breakpoint.
2. With a newer build deployed, an `Actualizar` button appears in the header on any page
   and applying it loads the new build.
3. With local changes not yet uploaded, the header offers **Guardar**, and pressing it
   makes the server's `updatedAt` advance and the button disappear.
4. With the server ahead, the header offers **Traer**, and pressing it applies the remote
   data.
5. When both are true, both buttons appear and nothing is applied until the user chooses.
6. A PUT the server discards results in an error state, never a success tick.
7. `lastSynced` never advances on a discarded write.
8. `npm test` and `npm run build` stay green.
