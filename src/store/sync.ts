import { create } from "zustand";
import type { CombatRecord } from "@/types/combatLog";
import type { DurableSheet } from "@/lib/durableSheet";
import type { SyncedState } from "@/lib/syncMerge";
import { extractDurable, applyDurable } from "@/lib/durableSheet";
import { getRemote, putState, postCombat } from "@/lib/syncApi";
import {
  isSyncEnabled,
  getLastSynced,
  setLastSynced,
} from "@/lib/syncConfig";
import { useCharacter } from "@/store/character";
import { useCoin, purseFor, type Purse } from "@/store/coin";
import { useCombatLog } from "@/store/combatLog";

/**
 * Cloud-sync orchestration. Offline-first: localStorage stays the source of
 * truth; this layer opportunistically pushes durable edits and pulls remote
 * changes. All failures are non-fatal — the UI never blocks on the network.
 *
 * NOT persisted — this is live runtime status only.
 */

export type SyncStatus = "idle" | "syncing" | "ok" | "error" | "offline";

interface SyncStoreState {
  status: SyncStatus;
  lastError?: string;
  /** Debounced push of the durable state blob. */
  pushStateDebounced: () => void;
  /** Push a single finished combat (idempotent server-side). */
  pushCombat: (record: CombatRecord) => Promise<void>;
  /** Pull the remote bundle and reconcile (LWW state, union combats). */
  pull: () => Promise<void>;
  /** Manual "Sync now": pull then push. */
  syncNow: () => Promise<void>;
}

/** The active character id, with the same fallback the views use. */
function activeCid(): string {
  return useCharacter.getState().activeCharacterId ?? "custom";
}

/** True while we're applying remote data, so it doesn't echo back as a push. */
let hydrating = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function offlineNow(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export const useSync = create<SyncStoreState>()((set) => {
  /** Build the current durable blob for the active character. */
  function buildState(cid: string): SyncedState {
    const sheet: DurableSheet = extractDurable(useCharacter.getState().character);
    const coin: Purse = purseFor(useCoin.getState(), cid);
    return { updatedAt: Date.now(), sheet, coin };
  }

  async function pushStateNow(): Promise<void> {
    if (!isSyncEnabled()) return;
    const cid = activeCid();
    set({ status: "syncing" });
    try {
      const state = buildState(cid);
      await putState(cid, state);
      setLastSynced(state.updatedAt);
      set({ status: "ok", lastError: undefined });
    } catch (e) {
      set({
        status: offlineNow() ? "offline" : "error",
        lastError: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function pull(): Promise<void> {
    if (!isSyncEnabled()) return;
    const cid = activeCid();
    set({ status: "syncing" });
    try {
      const { state: remote, combats } = await getRemote(cid);

      hydrating = true;
      // Combat records are immutable — always union in whatever the cloud has.
      if (combats.length > 0) useCombatLog.getState().mergeRecords(combats);

      // Durable state: last-write-wins against our local watermark.
      const watermark = getLastSynced() ?? 0;
      if (remote && remote.updatedAt > watermark) {
        const sheet = remote.sheet as DurableSheet;
        const coin = remote.coin as Purse;
        useCharacter.setState((s) => ({
          character: applyDurable(s.character, sheet),
        }));
        // NOT setState: a device on an older build pushes a purse with no magic
        // -item arrays, and sync overwrites the blob wholesale. applyRemotePurse
        // backfills them from the local purse so a stale peer can't delete them.
        useCoin.getState().applyRemotePurse(cid, coin);
        setLastSynced(remote.updatedAt);
      }
      set({ status: "ok", lastError: undefined });
    } catch (e) {
      set({
        status: offlineNow() ? "offline" : "error",
        lastError: e instanceof Error ? e.message : String(e),
      });
    } finally {
      hydrating = false;
    }
  }

  return {
    status: "idle",

    pushStateDebounced: () => {
      if (!isSyncEnabled()) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void pushStateNow();
      }, 1500);
    },

    pushCombat: async (record) => {
      if (!isSyncEnabled()) return;
      try {
        await postCombat(activeCid(), record);
        set({ status: "ok", lastError: undefined });
      } catch (e) {
        set({
          status: offlineNow() ? "offline" : "error",
          lastError: e instanceof Error ? e.message : String(e),
        });
      }
    },

    pull,

    syncNow: async () => {
      await pull();
      await pushStateNow();
    },
  };
});

/**
 * Wire local durable edits to a debounced push. Registered once at module load.
 * The `hydrating` guard stops a freshly-pulled change from echoing straight back
 * out as a push. Both subscriptions no-op unless sync is enabled.
 */
useCharacter.subscribe(() => {
  if (!hydrating) useSync.getState().pushStateDebounced();
});
useCoin.subscribe(() => {
  if (!hydrating) useSync.getState().pushStateDebounced();
});
