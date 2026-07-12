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

export interface Purse {
  /** Starting purse in gold, set once (editable). */
  startingGold: number;
  /** Movements, newest first. */
  entries: CoinEntry[];
  /** Side list of treasure found — text notes, not counted in the balance. */
  treasure: TreasureItem[];
}

const LEGACY = "__legacy__";
const emptyPurse = (): Purse => ({ startingGold: 0, entries: [], treasure: [] });
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
});

interface CoinState {
  /** Purses keyed by character id. */
  purses: Record<string, Purse>;
  setStartingGold: (cid: string, gold: number) => void;
  addEntry: (cid: string, amount: number, note: string) => void;
  removeEntry: (cid: string, id: string) => void;
  addTreasure: (cid: string, text: string) => void;
  removeTreasure: (cid: string, id: string) => void;
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
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2 && persisted && typeof persisted === "object") {
          const old = persisted as {
            startingGold?: number;
            entries?: CoinEntry[];
            treasure?: TreasureItem[];
          };
          return {
            purses: {
              [LEGACY]: {
                startingGold: old.startingGold ?? 0,
                entries: old.entries ?? [],
                treasure: old.treasure ?? [],
              },
            },
          } as unknown as CoinState;
        }
        return persisted as CoinState;
      },
    },
  ),
);
