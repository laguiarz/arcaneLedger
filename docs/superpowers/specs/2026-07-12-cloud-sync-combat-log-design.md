# Cloud Sync (per-character, offline-first) + Combat Log

**Date:** 2026-07-12
**Status:** Design approved, pending spec review
**Branch:** `feat/cloud-sync-combat-log`

## Problem

The app persists character sheet edits (abilities, HP, etc.) and the coin ledger
to `localStorage`, and throws away combat state on reload. `localStorage` is
per-browser, so nothing is available **across devices**. The user plays at the
table on a tablet and also wants to see the same durable state (abilities, gold)
on phone/laptop. They also want to keep a **history of finished combats** to
later assemble the character's ongoing story (Brunella / Lyari).

## Goal

1. Sync a character's **durable sheet edits + gold** across the user's devices.
2. Persist a **log of finished combats** per character, also synced.
3. Do it **offline-first** (never block play at the table) and **free** (no paid
   tiers).

## Decisions (locked during brainstorming)

- **Who:** single user (no login), but **multi-character** — state keyed by
  `characterId` (`activeCharacterId` from the character store).
- **Offline behavior:** **offline-first**. `localStorage` (existing Zustand
  `persist`) stays the local source of truth; cloud sync is a background nicety.
- **Backend:** **Vercel serverless functions + Upstash Redis** (blob store),
  reusing the existing serverless pattern (the Gemini proxy). Auth via a shared
  secret header. No realtime needed.
- **Gold model:** coin becomes **per-character** (today it is a single global
  purse). Migrate the current global purse to the active character on upgrade.
- **Cost constraint (hard):** **free-tier only.** Candidates, all with perpetual
  free tiers: Upstash Redis (~500K cmds/mo, 256 MB), Vercel Hobby serverless.
  Fallbacks if a tier changes: Upstash direct, or Cloudflare KV (100K reads/day).
  Implementation must verify current provider limits before coding.

## What syncs vs. what stays local

**Durable (synced) — sheet edits that outlive an encounter:**
- Abilities (base/feat/magic breakdown)
- Gold + treasure (per-character coin store)
- Max HP
- AC config (`armor`)
- Party names
- Level / proficiency bonus
- **Combat log** (finished-combat records — see below; synced via `char:{id}:combats`)

**Volatile (local only, NOT synced) — session/encounter state that should start
clean:**
- Spell slots, resources used, racial free casts
- Current HP / temp HP
- Conditions + exhaustion
- Hit dice spent
- Concentration

> The exact durable field list is a first-pass default; refine during
> implementation. Rule of thumb: "would I re-do this edit on the other device?"
> → durable. "Does it reset on a rest / next session?" → volatile.

## Architecture

### Storage (Upstash Redis) — two keys per character

- `char:{characterId}:state` → `{ updatedAt: number, sheet: DurableSheet, coin: CoinState }`
  - Conflict strategy: **last-write-wins** by `updatedAt`.
- `char:{characterId}:combats` → `CombatRecord[]`
  - Conflict strategy: **union by `id`** (records are immutable; a combat logged
    on device A is never overwritten by device B's push).

### Serverless API (Vercel), auth `Authorization: Bearer <secret>`

- `GET  /api/sync/[characterId]` → `{ state, combats }`
- `PUT  /api/sync/[characterId]` → upsert `state` blob, LWW by `updatedAt`
  (server rejects a write whose `updatedAt` is older than stored).
- `POST /api/sync/[characterId]/combats` → append one `CombatRecord`, idempotent
  by `id` (no-op if the id already exists).

All endpoints return `401` without a valid secret. Keep handlers thin; put merge
logic in a shared, unit-tested module.

### Client sync layer — `src/lib/sync.ts` + `useSync` store

- **Push:** debounced. On a durable-state change → `PUT`. On combat end → `POST`
  that record.
- **Pull:** on app load and on `window` `focus` / `online` → `GET`; if remote
  `state.updatedAt` > local, hydrate the character + coin stores; union combats
  into the local combat-log store.
- **Offline:** if a push fails (offline / error), mark sync as pending and retry
  on the next `focus`/`online`. Never block the UI. Because `localStorage` is
  already the source of truth, no separate write queue is needed — always push
  the latest local blob (last-write-wins is self-healing).
- **Settings UI:** secret input, sync on/off toggle, "last synced" timestamp,
  "Sync now" button, and a subtle pending/failed indicator.

### Combat log — `useCombatLog` store (persisted) + "Crónica" section

- On **end combat** in `/combat`, snapshot into a `CombatRecord`:
  `{ id, characterId, endedAt, title?, rounds, combatants, narration? }`.
- Surfaced as a **"Crónica" tab inside `/combat`** (not a separate nav item). The
  tab lists saved combats for the active character: view transcript (reuse
  `buildNarrationPayload`), (re)generate narration, delete.
- The combat *tracker* store (`useCombat`) stays ephemeral; only the **finished**
  record is persisted + synced.

## Data shapes

```ts
interface DurableSheet {
  abilities: Character["abilities"];
  hpMax: number;
  armor?: Character["armor"];
  party: string[];
  level: number;
  proficiencyBonus: number;
  // (first-pass subset — refine in implementation)
}

interface SyncedState {
  updatedAt: number;          // ms epoch, stamped on local edit
  sheet: DurableSheet;
  coin: CoinState;            // per-character
}

interface CombatRecord {
  id: string;                 // stable, dedup key for union merge
  characterId: string;
  endedAt: number;            // ms epoch
  title?: string;
  rounds: number;
  combatants: Combatant[];    // snapshot
  narration?: string;
}
```

## Merge logic (pure, unit-tested)

- `mergeState(local, remote)`: whichever has the larger `updatedAt` wins wholesale.
- `mergeCombats(local, remote)`: union by `id`, keep first-seen, sort by `endedAt`.

## Error handling

- Sync failures are non-fatal: subtle "sync pending / failed" indicator; retry on
  next `focus`/`online`. The app is fully usable offline.
- Missing/invalid secret → `401` → Settings shows "sync not configured".
- Malformed remote blob → ignore remote, keep local, log a warning (don't crash).

## Testing

- **Pure merge** (`mergeState`, `mergeCombats`): LWW picks newer; union dedups by
  `id`; ordering.
- **Sync layer** (mock `fetch`): push debounce, pull hydrates when remote newer,
  no-op when local newer, offline → pending → retry on focus.
- **Combat log store**: save/list/delete, snapshot integrity, per-character
  filtering.
- **Coin migration**: global purse → active character on version bump.
- **Serverless handlers** (where testable): `401` without secret, PUT LWW reject
  older, POST combats idempotent by id.

## Security

- Shared secret in `Authorization: Bearer` header; endpoints reject without it.
- Secret stored in `localStorage` (device-local), entered once in Settings.
- Not high-security, but adequate: single user, non-sensitive D&D data.
- Optional: light rate-limit on the serverless endpoints.

## Out of scope (YAGNI)

- Real auth / multiple players sharing one deploy.
- Realtime push between devices (offline-first + sync-on-focus is enough).
- Syncing volatile session state (spell usage, current HP, conditions).
- Relational queries (blobs, not SQL).

## Resolved during review

1. **Combat log is durable/synced** — confirmed. It rides in `char:{id}:combats`
   and is also persisted locally in `useCombatLog`.
2. **"Crónica" placement: a tab inside `/combat`** (not a separate nav item).
3. **Coin store → per-character**, keyed by `activeCharacterId`, with a `persist`
   version bump + migration of the existing global purse to the active character.

## Open items (refine during implementation, no gate)

- Exact `DurableSheet` field list (first-pass above; `level`/`proficiencyBonus`
  mostly come from import — keep them durable but low-risk).
