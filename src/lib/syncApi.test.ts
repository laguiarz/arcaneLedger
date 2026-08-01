import { describe, it, expect, vi, beforeEach } from "vitest";

// Node test env has no localStorage — stub the secret source directly.
vi.mock("./syncConfig", () => ({ getSecret: () => "test-secret" }));

import { getRemote, putState, postCombat } from "./syncApi";
import type { SyncedState } from "./syncMerge";
import type { CombatRecord } from "@/types/combatLog";

interface FetchInit {
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function mockFetch(response: {
  ok: boolean;
  status?: number;
  statusText?: string;
  json?: unknown;
}) {
  const fn = vi.fn(async (_url: string, _init: FetchInit) => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    statusText: response.statusText ?? "",
    json: async () => response.json ?? {},
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

const state: SyncedState = { updatedAt: 42, sheet: { a: 1 }, coin: { g: 2 } };
const record: CombatRecord = {
  id: "r1",
  characterId: "lyari",
  endedAt: 10,
  rounds: 2,
  combatants: [],
};

beforeEach(() => vi.unstubAllGlobals());

describe("syncApi", () => {
  it("getRemote sends the Bearer secret and returns the bundle", async () => {
    const fetchFn = mockFetch({ ok: true, json: { state, combats: [record] } });
    const bundle = await getRemote("lyari");

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/sync?characterId=lyari");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer test-secret");
    expect(bundle.state).toEqual(state);
    expect(bundle.combats).toHaveLength(1);
  });

  it("getRemote defaults missing fields to null/[]", async () => {
    mockFetch({ ok: true, json: {} });
    const bundle = await getRemote("lyari");
    expect(bundle.state).toBeNull();
    expect(bundle.combats).toEqual([]);
  });

  it("putState sends the state with the base stamp for compare-and-set", async () => {
    const fetchFn = mockFetch({ ok: true, json: { ok: true, applied: true, updatedAt: 99 } });
    const result = await putState("lyari", state, { baseUpdatedAt: 42 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/sync?characterId=lyari");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body ?? "{}")).toEqual({
      state,
      baseUpdatedAt: 42,
      force: false,
    });
    expect(result).toEqual({ ok: true, applied: true, updatedAt: 99 });
  });

  it("putState forwards force and surfaces a refusal", async () => {
    const fetchFn = mockFetch({ ok: true, json: { ok: true, applied: false, updatedAt: 7 } });
    const result = await putState("lyari", state, { baseUpdatedAt: null, force: true });
    const [, init] = fetchFn.mock.calls[0];
    expect(JSON.parse(init.body ?? "{}").force).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.updatedAt).toBe(7);
  });

  it("putState treats a legacy server's bare {ok:true} as applied", async () => {
    mockFetch({ ok: true, json: { ok: true } });
    const result = await putState("lyari", state, { baseUpdatedAt: 1 });
    expect(result.applied).toBeUndefined();
  });

  it("postCombat PUTs a { combat } body", async () => {
    const fetchFn = mockFetch({ ok: true });
    await postCombat("lyari", record);
    const [, init] = fetchFn.mock.calls[0];
    expect(JSON.parse(init.body ?? "{}")).toEqual({ combat: record });
  });

  it("throws on a 401 with the server error message", async () => {
    mockFetch({ ok: false, status: 401, json: { error: "Bad secret" } });
    await expect(getRemote("lyari")).rejects.toThrow("Bad secret");
  });
});
