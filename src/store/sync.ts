import { create } from "zustand";
import type { CombatRecord } from "@/types/combatLog";
import type { DurableSheet } from "@/lib/durableSheet";
import type { SyncedState } from "@/lib/syncMerge";
import { extractDurable, applyDurable } from "@/lib/durableSheet";
import { getRemote, putState, postCombat } from "@/lib/syncApi";
import { digestState, syncFlags } from "@/lib/syncFlags";
import {
  isSyncEnabled,
  setLastSynced,
  getBaseline,
  setBaseline,
  getAppliedUpdatedAt,
  setAppliedUpdatedAt,
} from "@/lib/syncConfig";
import { useCharacter } from "@/store/character";
import { useCoin, purseFor, type Purse } from "@/store/coin";
import { useCombatLog } from "@/store/combatLog";

/**
 * Cloud-sync orchestration. Offline-first: localStorage stays the source of
 * truth; this layer reports the difference between local and cloud and lets the
 * user decide what crosses.
 *
 * Two rules earned the hard way:
 *
 * 1. "Do I have unsaved work?" is answered by a CONTENT digest, never by a
 *    timestamp. A device that has never confirmed a sync has no baseline and is
 *    therefore treated as dirty — offering Save can only add data, offering
 *    nothing can lose it.
 * 2. Nothing is applied automatically. The old boot pull could overwrite a local
 *    edit before it had ever been uploaded, which is exactly how an edit
 *    disappears. Automatic work is limited to CHECKING, plus merging combat
 *    records, which are immutable and union-merged so they cannot clobber
 *    anything.
 *
 * NOT persisted — this is live runtime status only.
 */

export type SyncStatus =
  | "idle"
  | "syncing"
  | "ok"
  | "error"
  | "offline"
  | "conflict";

interface SyncStoreState {
  status: SyncStatus;
  lastError?: string;
  /** Server stamp seen by the most recent check. */
  remoteUpdatedAt: number | null;
  /** Local durable content differs from the last confirmed sync. */
  dirty: boolean;
  /** The cloud holds a stamp this device has not applied. */
  remoteAhead: boolean;
  /**
   * Sync is configured AND a character is active. Mirrored into the store so
   * the header re-renders when it changes — `isSyncEnabled()` reads
   * localStorage and is not reactive on its own.
   */
  enabled: boolean;

  /** Recalculate the flags from storage plus current store contents. */
  recompute: () => void;
  /** GET the remote stamp and merge combats. Applies no sheet or purse. */
  checkRemote: () => Promise<void>;
  /** User-initiated: apply the remote blob over local. */
  pullNow: () => Promise<void>;
  /** User-initiated (force) or debounced (not): upload the local blob. */
  pushNow: (opts?: { force?: boolean }) => Promise<void>;
  /** Debounced upload, skipped while the cloud is ahead. */
  pushStateDebounced: () => void;
  /** Push a single finished combat (idempotent server-side). */
  pushCombat: (record: CombatRecord) => Promise<void>;
}

/** The active character id, or null while the first-run picker is still up. */
function activeCid(): string | null {
  return useCharacter.getState().activeCharacterId;
}

/** True while applying remote data, so it doesn't echo back as a local change. */
let hydrating = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function offlineNow(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** The durable payload for a character: exactly what gets uploaded. */
function payloadFor(cid: string): { sheet: DurableSheet; coin: Purse } {
  return {
    sheet: extractDurable(useCharacter.getState().character),
    coin: purseFor(useCoin.getState(), cid),
  };
}

export const useSync = create<SyncStoreState>()((set, get) => {
  function failure(e: unknown) {
    set({
      status: offlineNow() ? "offline" : "error",
      lastError: e instanceof Error ? e.message : String(e),
    });
    // Recompute even on failure: `enabled` is mirrored here, and without this a
    // failed boot check leaves it false and the header hides the error instead
    // of showing it.
    recompute();
  }

  function recompute(): void {
    const cid = activeCid();
    const enabled = isSyncEnabled() && cid !== null;
    const current = cid ? digestState(payloadFor(cid)) : "";
    const { dirty, remoteAhead } = syncFlags({
      baseline: getBaseline(),
      current,
      lastAppliedUpdatedAt: getAppliedUpdatedAt(),
      remoteUpdatedAt: get().remoteUpdatedAt,
      enabled,
    });
    set({ dirty, remoteAhead, enabled });
  }

  async function checkRemote(): Promise<void> {
    const cid = activeCid();
    if (!isSyncEnabled() || cid === null) return;
    set({ status: "syncing" });
    try {
      const { state: remote, combats } = await getRemote(cid);
      // Immutable and union-merged, so applying them can never clobber local
      // work — combats keep flowing automatically.
      if (combats.length > 0) useCombatLog.getState().mergeRecords(combats);
      set({
        remoteUpdatedAt: remote?.updatedAt ?? null,
        status: "ok",
        lastError: undefined,
      });
      recompute();
    } catch (e) {
      failure(e);
    }
  }

  async function pullNow(): Promise<void> {
    const cid = activeCid();
    if (!isSyncEnabled() || cid === null) return;
    set({ status: "syncing" });
    try {
      const { state: remote, combats } = await getRemote(cid);
      hydrating = true;
      try {
        if (combats.length > 0) useCombatLog.getState().mergeRecords(combats);
        if (remote) {
          useCharacter.setState((s) => ({
            character: applyDurable(s.character, remote.sheet as DurableSheet),
          }));
          useCoin.getState().applyRemotePurse(cid, remote.coin as Purse);
          setAppliedUpdatedAt(remote.updatedAt);
          setLastSynced(remote.updatedAt);
        }
      } finally {
        hydrating = false;
      }
      // Baseline becomes the digest of what we now hold, so finishing a pull
      // doesn't leave the header immediately claiming there is work to save.
      if (remote) setBaseline(digestState(payloadFor(cid)));
      set({
        remoteUpdatedAt: remote?.updatedAt ?? null,
        status: "ok",
        lastError: undefined,
      });
      recompute();
    } catch (e) {
      failure(e);
    }
  }

  async function pushNow(opts?: { force?: boolean }): Promise<void> {
    const cid = activeCid();
    if (!isSyncEnabled() || cid === null) return;
    set({ status: "syncing" });
    try {
      const payload = payloadFor(cid);
      // The server stamps the stored value; this one is only a placeholder to
      // satisfy the shape.
      const state: SyncedState = { updatedAt: Date.now(), ...payload };
      const result = await putState(cid, state, {
        baseUpdatedAt: getAppliedUpdatedAt(),
        force: opts?.force === true,
      });

      // `applied === undefined` means a deployment older than compare-and-set:
      // treat it as applied, never as failure.
      if (result.applied === false) {
        set({
          status: "conflict",
          remoteUpdatedAt: result.updatedAt ?? get().remoteUpdatedAt,
          lastError: undefined,
        });
        recompute();
        return;
      }

      const stamp = result.updatedAt ?? state.updatedAt;
      setAppliedUpdatedAt(stamp);
      setLastSynced(stamp);
      setBaseline(digestState(payload));
      set({ remoteUpdatedAt: stamp, status: "ok", lastError: undefined });
      recompute();
    } catch (e) {
      failure(e);
    }
  }

  return {
    status: "idle",
    remoteUpdatedAt: null,
    dirty: false,
    remoteAhead: false,
    enabled: false,

    recompute,
    checkRemote,
    pullNow,
    pushNow,

    pushStateDebounced: () => {
      if (!isSyncEnabled() || activeCid() === null) return;
      // Never auto-upload into a known conflict — that decision is the user's.
      if (get().remoteAhead) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void pushNow();
      }, 1500);
    },

    pushCombat: async (record) => {
      const cid = activeCid();
      if (!isSyncEnabled() || cid === null) return;
      try {
        await postCombat(cid, record);
        set({ status: "ok", lastError: undefined });
      } catch (e) {
        failure(e);
      }
    },
  };
});

/**
 * Local durable edits recompute the flags (so the header reacts immediately)
 * and schedule an upload when there is no conflict. The `hydrating` guard stops
 * freshly-pulled data echoing straight back out.
 */
useCharacter.subscribe(() => {
  if (hydrating) return;
  useSync.getState().recompute();
  useSync.getState().pushStateDebounced();
});
useCoin.subscribe(() => {
  if (hydrating) return;
  useSync.getState().recompute();
  useSync.getState().pushStateDebounced();
});
