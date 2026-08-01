# Design — Magic items on the Coin page (party and personal)

Date: 2026-08-01
Status: approved (design agreed inline before this doc was written)

## Problem

The Coin page tracks gold (`Movements`) and a side list of loot to sell (`Treasure`).
There is nowhere to record **magic items** — the things the party keeps and uses rather
than cashes in. In particular there is no way to note *who in the party is carrying* a
shared item, which is the thing that actually gets forgotten between sessions.

## Goals

- A **party** magic-item list, where each item records which party member carries it.
- A **personal** magic-item list for the active character.
- Both usable mid-session: adding an item is a name, an optional note, and (for party
  items) a carrier picked from a list.

## Non-goals

- Attunement tracking and its 3-item limit. Considered and deliberately dropped — the
  note field can carry "sintonía" as text if wanted.
- Replacing or migrating the existing `Treasure` list. It stays exactly as it is:
  treasure is loot to sell, magic items are kept.
- Quantities, weight, or charges as structured fields.
- A shared party-wide store independent of the active character (see Scope below).

## Scope decision: items live with the active character

Collective items are stored in the **active character's purse**, alongside gold and
treasure, and sync through the existing per-character blob.

The honest trade-off, accepted deliberately: "collective" here means *the party's items
as tracked by this character*. If the user switches to a different character, that
character has its own party list. A genuinely shared store would need a new sync key —
the endpoint only understands `characterId` — plus a migration, which is not worth it
for a single player tracking one character.

## Data model

`src/store/coin.ts`, persisted store version **2 → 3**.

```ts
export interface MagicItem {
  id: string;
  name: string;
  /** Free text: what it does, charges, attunement… */
  note: string;
  /** Party items only: which party member carries it. "" = unassigned. */
  carrier?: string;
}

export interface Purse {
  startingGold: number;
  entries: CoinEntry[];
  treasure: TreasureItem[];
  partyItems: MagicItem[];    // new
  personalItems: MagicItem[]; // new
}
```

### Two independent defences, both required

1. **Persist migration v2 → v3** backfills `partyItems: []` and `personalItems: []`
   on every existing purse in localStorage, so current gold and treasure survive.

2. **Defensive reads everywhere** — `p.partyItems ?? []`. This is *not* redundant with
   the migration. The purse travels through cloud sync: a device still running an older
   build will push a purse blob with no item arrays, and `sync.ts` writes that blob
   straight into the store via `useCoin.setState`, bypassing the persist migration
   entirely. Without the defensive default, one pull from a stale device breaks the
   view. `EMPTY_PURSE` and `emptyPurse()` both gain the new arrays for the same reason.

## Store actions

```ts
type ItemScope = "party" | "personal";

addMagicItem: (cid: string, scope: ItemScope, name: string, note: string, carrier?: string) => void;
removeMagicItem: (cid: string, scope: ItemScope, id: string) => void;
/** Party items only — reassign who carries it. */
setItemCarrier: (cid: string, id: string, carrier: string) => void;
```

Consistent with the existing actions: `cid` first, blank names ignored, newest item
first, `newId()` for ids.

## Carrier list

Built in the view from the character store: the character's own `name`, then every entry
of `character.party`, plus an explicit "Sin asignar" default. A `<select>`, not free
text, so carrier names stay consistent and typos can't fragment the list. If `party` is
empty the picker still offers the character and "Sin asignar".

## UI

`src/views/Coin.tsx` keeps `Movements` (2 cols) and `Treasure` (1 col) untouched, and
gains a new row below with two equal sections: **Ítems colectivos** and **Ítems
personales**. They stack on mobile like the existing grid.

Each section has a compact add form (name, note, and for party items a carrier select)
and a list. Each row shows the name, the note underneath, the carrier as an inline
`<select>` for party items, and a delete button — matching the existing treasure rows.

Copy in Spanish, matching the newer components. Theme-aware tokens only.

## Sync

No server or endpoint change. The purse is already serialised whole into the sync blob
by `buildState()` in `src/store/sync.ts`, and `useCoin.subscribe` already triggers the
debounced push. The new fields travel for free.

## Testing

Store-level, pure, per the project's convention (no React Testing Library, no jsdom):

- Add and remove items in both scopes; blank names ignored.
- Carrier assignment and reassignment.
- **Migration v2 → v3** backfills the arrays and preserves existing gold, entries and
  treasure.
- **Defensive default**: a purse object with no item arrays (what a stale device pushes
  through sync) reads as empty lists rather than throwing.

UI verified manually in a browser. **Cloud sync must be disabled in that browser profile
first** — a previous session's UI test wrote to the real production data.

## Acceptance criteria

1. A party item can be added with a name, a note and a carrier chosen from the party.
2. The carrier can be changed afterwards from the list row.
3. A personal item can be added with a name and note.
4. Both lists survive a reload, and existing gold and treasure are intact after the
   version bump.
5. A purse blob lacking the new arrays does not break the page.
6. `npm test` and `npm run build` stay green.
