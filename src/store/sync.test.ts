import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The node test env has no localStorage, so every syncConfig helper would be a
 * silent no-op and these tests would pass vacuously. Mock it with real
 * in-memory state instead.
 */
const store = {
  enabled: true,
  baseline: null as string | null,
  applied: null as number | null,
  lastSynced: null as number | null,
};

vi.mock("@/lib/syncConfig", () => ({
  isSyncEnabled: () => store.enabled,
  getSecret: () => "test-secret",
  getBaseline: () => store.baseline,
  setBaseline: (d: string) => {
    store.baseline = d;
  },
  getAppliedUpdatedAt: () => store.applied,
  setAppliedUpdatedAt: (n: number) => {
    store.applied = n;
  },
  getLastSynced: () => store.lastSynced,
  setLastSynced: (n: number) => {
    store.lastSynced = n;
  },
}));

const putState = vi.fn();
const getRemote = vi.fn();
const postCombat = vi.fn();

vi.mock("@/lib/syncApi", () => ({
  putState: (...a: unknown[]) => putState(...a),
  getRemote: (...a: unknown[]) => getRemote(...a),
  postCombat: (...a: unknown[]) => postCombat(...a),
}));

import { useSync } from "@/store/sync";
import { useCharacter } from "@/store/character";

beforeEach(() => {
  store.enabled = true;
  store.baseline = null;
  store.applied = null;
  store.lastSynced = null;
  putState.mockReset();
  getRemote.mockReset();
  postCombat.mockReset();
  useCharacter.setState({ activeCharacterId: "c1" });
  useSync.setState({
    status: "idle",
    remoteUpdatedAt: null,
    dirty: false,
    remoteAhead: false,
    lastError: undefined,
  });
});

describe("pushNow", () => {
  it("records the baseline and the server's stamp when the write is applied", async () => {
    putState.mockResolvedValue({ ok: true, applied: true, updatedAt: 555 });

    await useSync.getState().pushNow();

    expect(store.baseline).not.toBeNull();
    expect(store.applied).toBe(555);
    expect(useSync.getState().status).toBe("ok");
    expect(useSync.getState().dirty).toBe(false);
  });

  it("does NOT record a baseline when the server refuses the write", async () => {
    putState.mockResolvedValue({ ok: true, applied: false, updatedAt: 777 });

    await useSync.getState().pushNow();

    // The whole point: a refused write must never look like a success, and must
    // never mark the local content as safely stored.
    expect(store.baseline).toBeNull();
    expect(store.applied).toBeNull();
    expect(useSync.getState().status).toBe("conflict");
    expect(useSync.getState().remoteUpdatedAt).toBe(777);
    expect(useSync.getState().dirty).toBe(true);
  });

  it("treats a legacy server's bare {ok:true} as applied", async () => {
    putState.mockResolvedValue({ ok: true });

    await useSync.getState().pushNow();

    expect(store.baseline).not.toBeNull();
    expect(useSync.getState().status).toBe("ok");
  });

  it("forwards the base stamp and the force flag", async () => {
    store.applied = 42;
    putState.mockResolvedValue({ ok: true, applied: true, updatedAt: 99 });

    await useSync.getState().pushNow({ force: true });

    expect(putState.mock.calls[0][2]).toEqual({ baseUpdatedAt: 42, force: true });
  });

  it("does nothing while no character is active", async () => {
    useCharacter.setState({ activeCharacterId: null });
    await useSync.getState().pushNow();
    expect(putState).not.toHaveBeenCalled();
  });
});

describe("checkRemote", () => {
  it("records the remote stamp without touching the character sheet", async () => {
    const before = useCharacter.getState().character.hp.max;
    getRemote.mockResolvedValue({
      state: { updatedAt: 321, sheet: { hpMax: before + 10 }, coin: {} },
      combats: [],
    });

    await useSync.getState().checkRemote();

    expect(useSync.getState().remoteUpdatedAt).toBe(321);
    expect(useCharacter.getState().character.hp.max).toBe(before);
    expect(useSync.getState().remoteAhead).toBe(true);
  });

  it("is a no-op when sync is disabled", async () => {
    store.enabled = false;
    await useSync.getState().checkRemote();
    expect(getRemote).not.toHaveBeenCalled();
  });
});

describe("flags", () => {
  it("reports dirty when this device has never confirmed a sync", () => {
    useSync.getState().recompute();
    expect(useSync.getState().dirty).toBe(true);
  });
});
