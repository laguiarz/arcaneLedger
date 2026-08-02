import { describe, it, expect } from "vitest";
import { digestState, syncFlags, syncHeaderState } from "./syncFlags";

describe("digestState", () => {
  it("is stable regardless of key order", () => {
    expect(digestState({ a: 1, b: [1, 2] })).toBe(digestState({ b: [1, 2], a: 1 }));
  });

  it("differs when content differs", () => {
    expect(digestState({ hpMax: 28 })).not.toBe(digestState({ hpMax: 33 }));
  });

  it("survives nested structures and nulls", () => {
    const payload = { sheet: { hpMax: 33, party: ["Kael"], armor: null }, coin: { entries: [] } };
    expect(digestState(payload)).toBe(digestState(structuredClone(payload)));
  });
});

describe("syncFlags", () => {
  const base = {
    baseline: "x",
    current: "x",
    lastAppliedUpdatedAt: 5,
    remoteUpdatedAt: 5,
    enabled: true,
  };

  it("is clean when the digest matches and the stamps agree", () => {
    expect(syncFlags(base)).toEqual({ dirty: false, remoteAhead: false });
  });

  it("treats a missing baseline as dirty (the upgrading device)", () => {
    expect(syncFlags({ ...base, baseline: null }).dirty).toBe(true);
  });

  it("is dirty when the content digest changed", () => {
    expect(syncFlags({ ...base, current: "y" }).dirty).toBe(true);
  });

  it("flags remoteAhead when the server stamp differs from the applied one", () => {
    expect(syncFlags({ ...base, remoteUpdatedAt: 9 }).remoteAhead).toBe(true);
  });

  it("does not flag remoteAhead when the server has nothing yet", () => {
    expect(syncFlags({ ...base, remoteUpdatedAt: null }).remoteAhead).toBe(false);
  });

  it("reports nothing when sync is disabled", () => {
    expect(
      syncFlags({ ...base, baseline: null, remoteUpdatedAt: 9, enabled: false }),
    ).toEqual({ dirty: false, remoteAhead: false });
  });
});

describe("syncHeaderState", () => {
  const d = {
    status: "idle" as const,
    dirty: false,
    remoteAhead: false,
    enabled: true,
    hasCharacter: true,
  };

  it("hides the region only when no character is active", () => {
    expect(syncHeaderState({ ...d, hasCharacter: false }).kind).toBe("hidden");
  });

  it("reports sync-off explicitly rather than rendering nothing", () => {
    // An empty header is indistinguishable from a broken one — this is exactly
    // how a user concluded the save button was missing when sync was just off.
    expect(syncHeaderState({ ...d, enabled: false }).kind).toBe("off");
  });

  it("shows synced, save, fetch and conflict", () => {
    expect(syncHeaderState(d).kind).toBe("synced");
    expect(syncHeaderState({ ...d, dirty: true }).kind).toBe("save");
    expect(syncHeaderState({ ...d, remoteAhead: true }).kind).toBe("fetch");
    expect(syncHeaderState({ ...d, dirty: true, remoteAhead: true }).kind).toBe("conflict");
  });

  it("lets an in-flight status win over the affordance", () => {
    expect(syncHeaderState({ ...d, dirty: true, status: "syncing" }).kind).toBe("busy");
  });

  it("surfaces errors with their message", () => {
    expect(syncHeaderState({ ...d, status: "error", message: "boom" })).toEqual({
      kind: "error",
      message: "boom",
    });
  });
});
