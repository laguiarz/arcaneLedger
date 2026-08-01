# Design — Magic items on the Coin page (party and personal)

Date: 2026-08-01
Status: approved (design agreed inline), then **revised after an adversarial spec review** —
see "Revisions after review" at the end for what changed and why.

## Problem

The Coin page tracks gold (`Movements`) and a side list of loot to sell (`Treasure`).
There is nowhere to record **magic items** — the things the party keeps and uses rather
than cashes in. In particular there is no way to note *who in the party is carrying* a
shared item, which is the thing that actually gets forgotten between sessions.

## Goals

- A **party** magic-item list, where each item records which party member carries it.
- A **personal** magic-item list for the active character.
- Both usable mid-session: adding an item is a name, an optional note, and (for party
  items) a carrier picked from a list. Notes are editable in place, because that is
  where charges live and charges change during play.

## Non-goals

- Attunement tracking and its 3-item limit. The note field can carry "sintonía" as text.
- Replacing or migrating the existing `Treasure` list. It stays exactly as it is:
  treasure is loot to sell, magic items are kept.
- Quantities, weight, or charges as structured fields.
- A shared party-wide store independent of the active character (see Scope below).
- Field-level merge in cloud sync. Sync stays last-write-wins on the whole blob; this
  spec only removes the *silent data loss* that shape drift would otherwise cause.

## Scope decision: items live with the active character

Collective items are stored in the **active character's purse**, alongside gold and
treasure, and sync through the existing per-character blob.

The honest trade-off, accepted deliberately: "collective" here means *the party's items
as tracked by this character*. If the user switches to a different character, that
character has its own party list. A genuinely shared store would need a new sync key —
`api/sync.ts` is keyed on `characterId` only — plus a migration, which is not worth it
for a single player tracking one character.

## Data model

`src/store/coin.ts`, persisted store version **2 → 3**.

```ts
export interface MagicItem {
  id: string;
  name: string;
  /** Free text: what it does, charges, attunement… Editable in place. */
  note: string;
  /** Who carries it. `""` = unassigned. Only meaningful for party items. */
  carrier: string;
}

export interface Purse {
  startingGold: number;
  entries: CoinEntry[];
  treasure: TreasureItem[];
  partyItems: MagicItem[];    // new
  personalItems: MagicItem[]; // new
}
```

Both new fields are **required, never optional**, and `carrier` has exactly one encoding
for "unassigned" (`""`, not `undefined`). The required type is made true at runtime by
normalising at the two — and only two — boundaries where a foreign purse shape can
enter. See below.

### The two entry points where an array-less purse can appear

A purse missing the new arrays can reach the store by exactly two routes. Each gets a
normaliser; **nothing else in the codebase does defensive `?? []`.**

1. **localStorage** → the persist `migrate`.
2. **Cloud sync** → `pull()` in `src/store/sync.ts` writes a remote blob straight into
   the store, bypassing persist entirely. A device still running an older build pushes a
   purse with no item arrays.

**Route 2 is a data-loss bug, not a rendering bug.** `api/sync.ts` overwrites the state
key wholesale when `updatedAt >= existing` — there is no field merge — and `pull()`
*replaces* the local purse. So: device A adds items → an older device B pushes its
array-less purse at a newer stamp → the cloud loses the items → A pulls → A's items are
gone locally and persisted. Unrecoverable. A `?? []` at the render site would prevent a
crash while doing nothing about the deletion.

**Fix:** the coin store exports

```ts
/** Normalise a purse arriving from cloud sync, keeping local items the remote lacks. */
applyRemotePurse: (cid: string, remote: Purse) => void;
```

which backfills each missing array from the **local** purse rather than from `[]`, and
`sync.ts` calls it instead of writing `useCoin.setState` directly. That turns "the remote
is on an older shape" from a destructive event into a no-op. The normalisation lives in
the coin store, not in `sync.ts`, so knowledge of the purse shape stays in one place.

Residual risk, accepted and stated: an older device that edits *before* its first
successful pull still overwrites the cloud copy. Closing that needs field-level merge,
which is a non-goal. The loss window is narrow and shrinks to zero once every device has
this build.

### Migration must be a pure, exported function

The persist `migrate` **cannot be tested through the store**: under Vitest the
environment is `node`, so `window` is undefined, `createJSONStorage(() => window.localStorage)`
returns undefined, and zustand's persist middleware returns early without attaching
`api.persist` (`zustand/esm/middleware.mjs`). Verified empirically with a throwaway probe
test — `typeof window === "undefined"` and `typeof useCoin.persist === "undefined"` both
hold. This is also why the v1→v2 migration test that the previous plan called for was
silently never written.

So: extract

```ts
export function migrateCoin(persisted: unknown, version: number): CoinState;
```

and reference it from the persist config. The test targets the pure function.

Two requirements on its shape:

- **Sequential fall-through, not early return.** The current v1→v2 branch *returns* a
  hand-built purse literal, so a `version < 3` branch added after it would never run for
  a v1 store. v1 must flow through v2 and then v3. Otherwise `adoptLegacyPurse` copies
  the `__legacy__` purse verbatim onto the active character and the arrays are missing
  again.
- **Backfill with `??`, never unconditional `[]`.** An older build re-stamps localStorage
  with its own `version: 2`, so on the next new-build load `migrateCoin(state, 2)` runs
  *again* over purses that already contain items. An unconditional `partyItems: []` would
  wipe them. The migration must be idempotent.

## Store actions

One action per list — matching the existing convention (`addEntry`/`addTreasure`,
`removeEntry`/`removeTreasure`), with no `scope` discriminator — and an **options object**
for the fields, so three adjacent strings can never be transposed silently:

```ts
addPartyItem:      (cid: string, item: { name: string; note?: string; carrier?: string }) => void;
addPersonalItem:   (cid: string, item: { name: string; note?: string }) => void;
removePartyItem:   (cid: string, id: string) => void;
removePersonalItem:(cid: string, id: string) => void;
/** Patch a party item — used for the carrier select and the note. */
updatePartyItem:   (cid: string, id: string, patch: Partial<Omit<MagicItem, "id">>) => void;
updatePersonalItem:(cid: string, id: string, patch: Partial<Omit<MagicItem, "id">>) => void;
applyRemotePurse:  (cid: string, remote: Purse) => void;
```

Blank names are ignored, newest first, ids from `newId()` — all consistent with the
existing actions.

## Carrier list

A shared pure helper, since `src/views/Combat.tsx:74` already builds the same roster
inline (`[character.name, ...(character.party ?? [])]`):

```ts
/** The character plus their party, in display order. Pure, testable. */
export function partyRoster(c: Pick<Character, "name" | "party">): string[];
```

The `<select>` offers "Sin asignar" (`""`) plus the roster. **Dangling carriers must
render as an extra option.** A carrier can fall out of the roster in three real ways: a
party member is removed in `AddCombatantForm`, `party` is replaced wholesale by a sync
pull (`applyDurable`), or the character is re-imported under a different name. A
`<select>` whose `value` matches no option renders blank — the row would silently read
as unassigned while still storing the old name, and one stray change event would commit
that lie. So when `carrier` is non-empty and not in the roster, append it as
`"<name> (fuera del grupo)"`.

## UI

`src/views/Coin.tsx` keeps `Movements` (2 cols) and `Treasure` (1 col) untouched, and
gains a new row below with two equal sections: **Party items** and **Personal items**.
They stack on mobile like the existing grid.

Each section has a compact add form (name, note, and for party items a carrier select)
and a list. Each row shows the name, an editable note underneath, the carrier as an
inline `<select>` for party items, and a delete button — matching the existing treasure
rows.

**Copy is English**, matching the page it lives on — `Coin.tsx` is entirely English
("Coin Purse", "Movements", "Treasure", "Nothing hoarded yet"). Spanish labels next to
those would leave the page half and half. This differs from the newer Settings
components, which are Spanish; page-level consistency wins. Theme-aware tokens only.

**Selector guardrail:** never write `?? []` inside a Zustand selector. `purseFor` returns
a frozen `EMPTY_PURSE` singleton precisely so selector identity stays stable — a fresh
`[]` per snapshot would reintroduce the `getSnapshot` infinite-render loop the store
documents at `coin.ts:38-48`. Select the purse once and derive the lists in the component
body. (`EMPTY_PURSE`'s freeze is shallow, so never sort or push these arrays in place;
copy first.)

## Sync

No server or endpoint change. `buildState()` in `src/store/sync.ts` already serialises
the purse whole via `purseFor`, and `useCoin.subscribe` already triggers the debounced
push, so the new fields travel for free. The only change in `sync.ts` is that `pull()`
calls `applyRemotePurse` instead of `useCoin.setState`.

## Testing

Store-level and pure, per the project convention (no React Testing Library, no jsdom):

- Add and remove items in both lists; blank names ignored; newest first.
- `updatePartyItem` sets the carrier, and updates a note.
- `partyRoster` — character plus party, and a character with no party.
- `migrateCoin`: v1 → v3 in one pass (arrays present, gold/entries/treasure preserved);
  v2 → v3 backfill; **idempotent over an already-v3 purse holding items**.
- `applyRemotePurse`: a remote purse with no item arrays keeps the local items;
  a remote purse with arrays replaces them.

**`src/store/coin.test.ts` must be updated, not just extended.** Its `purse()` helper
builds a three-field `Purse` literal (a type error once the fields are required — `build`
runs `tsc -b` and `tsconfig.json` includes `src`), and its `purseFor` test asserts
`toEqual` against a three-key object (a runtime failure once `EMPTY_PURSE` grows).

UI verified manually in a browser. **Cloud sync must be disabled in that browser profile
first** — a previous session's UI test wrote to real production data.

## Acceptance criteria

1. A party item can be added with a name, a note and a carrier chosen from the party.
2. The carrier can be changed afterwards from the list row, and a note edited in place.
3. A personal item can be added with a name and note.
4. Items can be deleted from both lists.
5. A party item added while character X is active does not appear under character Y.
6. Both lists survive a reload, and existing gold, entries and treasure are intact after
   the version bump.
7. A remote purse lacking the new arrays leaves local items untouched — no crash, and no
   deletion.
8. Items survive a full sync round-trip (push, then pull on a second profile).
9. `npm test` and `npm run build` stay green, including the updated `coin.test.ts`.

## Revisions after review

An adversarial critic reviewed the first version of this spec against the code. Accepted
and folded in: the migration is untestable through the store and must be extracted as a
pure function (verified independently with a probe test); `coin.test.ts` breaks and must
be listed as modified; the cross-device failure is silent **deletion**, not a broken
view, so the defence moved to a single normalising choke point instead of scattered
`?? []`; the v1→v2 branch's early return would skip the v3 backfill; an unconditional
backfill would wipe items when an older build re-stamps the version; `?? []` inside a
selector would reintroduce the documented `getSnapshot` loop; the `scope` parameter and
five positional args were replaced with per-list actions taking an options object;
dangling carriers are a reachable gap; "unassigned" had two encodings; and the page would
have ended up half Spanish, half English.

Two departures from the critic's suggestions, on purpose: the sync normalisation is an
exported coin-store action rather than inline code in `sync.ts`, so purse-shape knowledge
stays in the coin store; and in-place note editing was added rather than declared a
non-goal, because the note is where charges live and delete-and-retype at the table is
worse than one more action.
