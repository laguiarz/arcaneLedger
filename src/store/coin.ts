import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Coin ledger — one purse **per character**, keyed by `activeCharacterId`.
 * Gold is the only denomination tracked; silver/copper aren't worth the
 * bookkeeping. Everything lives in localStorage and is a candidate for cloud
 * sync (see the sync layer).
 *
 * v1 stored a single global purse (`{ startingGold, entries, treasure }`);
 * v2 wraps that legacy purse under the `__legacy__` key and {@link
 * useCoin.adoptLegacyPurse} moves it onto whichever character is active first.
 */

export interface CoinEntry {
  id: string;
  /** Signed gold: positive = income, negative = expense. */
  amount: number;
  note: string;
}

export interface TreasureItem {
  id: string;
  text: string;
}

export interface MagicItem {
  id: string;
  name: string;
  /** Free text: what it does, charges, attunement… Editable in place. */
  note: string;
  /** Who carries it. `""` = unassigned. Only meaningful for party items. */
  carrier: string;
}

export interface Purse {
  /** Starting purse in gold, set once (editable). */
  startingGold: number;
  /** Movements, newest first. */
  entries: CoinEntry[];
  /** Side list of treasure found — text notes, not counted in the balance. */
  treasure: TreasureItem[];
  /** Party magic items, newest first. Each records who carries it. */
  partyItems: MagicItem[];
  /** This character's own magic items, newest first. */
  personalItems: MagicItem[];
}

const LEGACY = "__legacy__";
const emptyPurse = (): Purse => ({
  startingGold: 0,
  entries: [],
  treasure: [],
  partyItems: [],
  personalItems: [],
});
/**
 * A single stable, frozen empty purse. {@link purseFor} returns THIS reference
 * for a character with no purse yet, so a `useCoin((s) => purseFor(s, cid))`
 * selector keeps a stable identity across renders (a fresh object each time
 * would trip Zustand's getSnapshot equality check → infinite re-render loop).
 */
const EMPTY_PURSE: Purse = Object.freeze({
  startingGold: 0,
  entries: [],
  treasure: [],
  partyItems: [],
  personalItems: [],
});

interface CoinState {
  /** Purses keyed by character id. */
  purses: Record<string, Purse>;
  setStartingGold: (cid: string, gold: number) => void;
  addEntry: (cid: string, amount: number, note: string) => void;
  removeEntry: (cid: string, id: string) => void;
  addTreasure: (cid: string, text: string) => void;
  removeTreasure: (cid: string, id: string) => void;

  // Magic items — one action per list, matching addEntry/addTreasure. Fields go
  // in an options object so three adjacent strings can't be transposed silently.
  addPartyItem: (
    cid: string,
    item: { name: string; note?: string; carrier?: string },
  ) => void;
  addPersonalItem: (cid: string, item: { name: string; note?: string }) => void;
  removePartyItem: (cid: string, id: string) => void;
  removePersonalItem: (cid: string, id: string) => void;
  updatePartyItem: (
    cid: string,
    id: string,
    patch: Partial<Omit<MagicItem, "id">>,
  ) => void;
  updatePersonalItem: (
    cid: string,
    id: string,
    patch: Partial<Omit<MagicItem, "id">>,
  ) => void;

  /**
   * Write a purse pulled from cloud sync. Backfills item lists the remote lacks
   * from the LOCAL purse: a device on an older build pushes a purse with no
   * item arrays, and sync overwrites wholesale, so taking the remote verbatim
   * would silently delete every item on every device.
   */
  applyRemotePurse: (cid: string, remote: Purse) => void;
  /** One-time: move the pre-v2 global purse into `cid` if it has none yet. */
  adoptLegacyPurse: (cid: string) => void;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** The purse for a character, or a fresh empty one. Pure selector. */
export function purseFor(
  state: { purses: Record<string, Purse> },
  cid: string,
): Purse {
  return state.purses[cid] ?? EMPTY_PURSE;
}

/** Running balance = starting gold + sum of every entry. */
export function coinBalance(purse: Purse): number {
  return purse.entries.reduce((sum, e) => sum + e.amount, purse.startingGold);
}

function patchPurse(
  purses: Record<string, Purse>,
  cid: string,
  fn: (p: Purse) => Purse,
): Record<string, Purse> {
  const cur = purses[cid] ?? emptyPurse();
  return { ...purses, [cid]: fn(cur) };
}

function patchItem(
  list: MagicItem[],
  id: string,
  patch: Partial<Omit<MagicItem, "id">>,
): MagicItem[] {
  return list.map((i) => (i.id === id ? { ...i, ...patch } : i));
}

function makeItem(input: {
  name: string;
  note?: string;
  carrier?: string;
}): MagicItem {
  return {
    id: newId(),
    name: input.name.trim(),
    note: (input.note ?? "").trim(),
    carrier: input.carrier ?? "",
  };
}

/**
 * Backfill a purse that predates the item lists. Uses `??`, never a bare `[]`:
 * an older build re-stamps localStorage with its own version, so this can run
 * again over a purse that already holds items — it must be idempotent.
 */
function withItemLists(p: Purse): Purse {
  return {
    ...p,
    partyItems: p.partyItems ?? [],
    personalItems: p.personalItems ?? [],
  };
}

/**
 * Persisted-state migration, exported and pure ON PURPOSE. Under Vitest the
 * environment is `node`, so `window` is undefined, `createJSONStorage` returns
 * undefined, and zustand's persist middleware returns early without ever
 * attaching `api.persist` — the migration is unreachable through the store and
 * can only be tested by calling it directly.
 *
 * Falls through, never returns early: a v1 store must pass through v2 AND v3.
 */
export function migrateCoin(persisted: unknown, version: number): CoinState {
  let state = persisted as CoinState;

  // v1 → v2: one global purse becomes the __legacy__ per-character purse, which
  // adoptLegacyPurse later moves onto the first character viewed.
  if (version < 2 && state && typeof state === "object") {
    const old = state as unknown as {
      startingGold?: number;
      entries?: CoinEntry[];
      treasure?: TreasureItem[];
    };
    state = {
      purses: {
        [LEGACY]: {
          startingGold: old.startingGold ?? 0,
          entries: old.entries ?? [],
          treasure: old.treasure ?? [],
          partyItems: [],
          personalItems: [],
        },
      },
    } as unknown as CoinState;
  }

  // v2 → v3: every purse gains the magic-item lists.
  if (state && typeof state === "object" && state.purses) {
    state = {
      ...state,
      purses: Object.fromEntries(
        Object.entries(state.purses).map(([k, p]) => [k, withItemLists(p)]),
      ),
    } as CoinState;
  }

  return state;
}

export const useCoin = create<CoinState>()(
  persist(
    (set) => ({
      purses: {},

      setStartingGold: (cid, gold) =>
        set((s) => ({
          purses: patchPurse(s.purses, cid, (p) => ({
            ...p,
            startingGold: Math.round(Number.isFinite(gold) ? gold : 0),
          })),
        })),

      addEntry: (cid, amount, note) =>
        set((s) => {
          const amt = Math.round(amount);
          if (!amt) return s; // ignore no-op zero entries
          return {
            purses: patchPurse(s.purses, cid, (p) => ({
              ...p,
              entries: [{ id: newId(), amount: amt, note: note.trim() }, ...p.entries],
            })),
          };
        }),

      removeEntry: (cid, id) =>
        set((s) => ({
          purses: patchPurse(s.purses, cid, (p) => ({
            ...p,
            entries: p.entries.filter((e) => e.id !== id),
          })),
        })),

      addTreasure: (cid, text) =>
        set((s) => {
          const t = text.trim();
          if (!t) return s;
          return {
            purses: patchPurse(s.purses, cid, (p) => ({
              ...p,
              treasure: [{ id: newId(), text: t }, ...p.treasure],
            })),
          };
        }),

      removeTreasure: (cid, id) =>
        set((s) => ({
          purses: patchPurse(s.purses, cid, (p) => ({
            ...p,
            treasure: p.treasure.filter((t) => t.id !== id),
          })),
        })),

      addPartyItem: (cid, item) =>
        set((s) => {
          if (!item.name.trim()) return s;
          return {
            purses: patchPurse(s.purses, cid, (p) => ({
              ...p,
              partyItems: [makeItem(item), ...p.partyItems],
            })),
          };
        }),

      addPersonalItem: (cid, item) =>
        set((s) => {
          if (!item.name.trim()) return s;
          return {
            purses: patchPurse(s.purses, cid, (p) => ({
              ...p,
              personalItems: [makeItem(item), ...p.personalItems],
            })),
          };
        }),

      removePartyItem: (cid, id) =>
        set((s) => ({
          purses: patchPurse(s.purses, cid, (p) => ({
            ...p,
            partyItems: p.partyItems.filter((i) => i.id !== id),
          })),
        })),

      removePersonalItem: (cid, id) =>
        set((s) => ({
          purses: patchPurse(s.purses, cid, (p) => ({
            ...p,
            personalItems: p.personalItems.filter((i) => i.id !== id),
          })),
        })),

      updatePartyItem: (cid, id, patch) =>
        set((s) => ({
          purses: patchPurse(s.purses, cid, (p) => ({
            ...p,
            partyItems: patchItem(p.partyItems, id, patch),
          })),
        })),

      updatePersonalItem: (cid, id, patch) =>
        set((s) => ({
          purses: patchPurse(s.purses, cid, (p) => ({
            ...p,
            personalItems: patchItem(p.personalItems, id, patch),
          })),
        })),

      applyRemotePurse: (cid, remote) =>
        set((s) => {
          const local = s.purses[cid] ?? emptyPurse();
          return {
            purses: {
              ...s.purses,
              [cid]: {
                ...remote,
                partyItems: remote.partyItems ?? local.partyItems,
                personalItems: remote.personalItems ?? local.personalItems,
              },
            },
          };
        }),

      adoptLegacyPurse: (cid) =>
        set((s) => {
          const legacy = s.purses[LEGACY];
          // No legacy purse, or this character already has one → nothing to do.
          if (!legacy || s.purses[cid]) return s;
          const { [LEGACY]: _drop, ...rest } = s.purses;
          return { purses: { ...rest, [cid]: legacy } };
        }),
    }),
    {
      name: "arcanist-ledger:coin",
      // v2: single global purse → per-character purses.
      // v3: purses gain partyItems / personalItems.
      version: 3,
      migrate: migrateCoin,
    },
  ),
);
