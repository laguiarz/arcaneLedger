import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Coin ledger — a single global gold book, deliberately decoupled from the
 * character (and its persistence version). Everything here lives in
 * localStorage only; per the current scope that's fine. Gold is the only
 * denomination tracked — silver/copper aren't worth the bookkeeping.
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

interface CoinState {
  /** Starting purse in gold, set once (editable). */
  startingGold: number;
  /** Movements, newest first. */
  entries: CoinEntry[];
  /** Side list of treasure found — text notes, not counted in the balance. */
  treasure: TreasureItem[];

  setStartingGold: (gold: number) => void;
  addEntry: (amount: number, note: string) => void;
  removeEntry: (id: string) => void;
  addTreasure: (text: string) => void;
  removeTreasure: (id: string) => void;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Running balance = starting gold + sum of every entry. */
export function coinBalance(startingGold: number, entries: CoinEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, startingGold);
}

export const useCoin = create<CoinState>()(
  persist(
    (set) => ({
      startingGold: 0,
      entries: [],
      treasure: [],

      setStartingGold: (gold) =>
        set({ startingGold: Math.round(Number.isFinite(gold) ? gold : 0) }),

      addEntry: (amount, note) =>
        set((s) => {
          const amt = Math.round(amount);
          if (!amt) return s; // ignore no-op zero entries
          return {
            entries: [{ id: newId(), amount: amt, note: note.trim() }, ...s.entries],
          };
        }),

      removeEntry: (id) =>
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

      addTreasure: (text) =>
        set((s) => {
          const t = text.trim();
          if (!t) return s;
          return { treasure: [{ id: newId(), text: t }, ...s.treasure] };
        }),

      removeTreasure: (id) =>
        set((s) => ({ treasure: s.treasure.filter((t) => t.id !== id) })),
    }),
    {
      name: "arcanist-ledger:coin",
      version: 1,
    },
  ),
);
