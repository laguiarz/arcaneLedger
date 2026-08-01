import { describe, it, expect, beforeEach } from "vitest";
import {
  coinBalance,
  migrateCoin,
  purseFor,
  useCoin,
  type Purse,
} from "@/store/coin";

const purse = (startingGold: number, amounts: number[]): Purse => ({
  startingGold,
  entries: amounts.map((amount, i) => ({ id: String(i), amount, note: "" })),
  treasure: [],
  partyItems: [],
  personalItems: [],
});

beforeEach(() => useCoin.setState({ purses: {} }));

describe("coinBalance", () => {
  it("returns starting gold with no entries", () => {
    expect(coinBalance(purse(100, []))).toBe(100);
  });
  it("adds income and subtracts expenses", () => {
    expect(coinBalance(purse(100, [50, -30, 10]))).toBe(130);
  });
  it("can go negative", () => {
    expect(coinBalance(purse(0, [-25]))).toBe(-25);
  });
});

describe("purseFor", () => {
  it("returns an empty purse for an unknown character", () => {
    expect(purseFor({ purses: {} }, "nobody")).toEqual({
      startingGold: 0,
      entries: [],
      treasure: [],
      partyItems: [],
      personalItems: [],
    });
  });

  it("returns a STABLE reference for a missing purse (no getSnapshot loop)", () => {
    const state = { purses: {} };
    // Same identity across calls → safe to use directly as a Zustand selector.
    expect(purseFor(state, "nobody")).toBe(purseFor(state, "nobody"));
  });
});

describe("useCoin — per-character purses", () => {
  it("keeps each character's gold separate", () => {
    useCoin.getState().setStartingGold("c1", 100);
    useCoin.getState().addEntry("c1", 50, "sold gems");
    useCoin.getState().addEntry("c2", 10, "found coins");

    expect(coinBalance(purseFor(useCoin.getState(), "c1"))).toBe(150);
    expect(coinBalance(purseFor(useCoin.getState(), "c2"))).toBe(10);
  });

  it("adds newest-first and removes entries by id", () => {
    useCoin.getState().addEntry("c1", 5, "first");
    useCoin.getState().addEntry("c1", 7, "second");
    const p = purseFor(useCoin.getState(), "c1");
    expect(p.entries[0].note).toBe("second");
    useCoin.getState().removeEntry("c1", p.entries[0].id);
    expect(purseFor(useCoin.getState(), "c1").entries).toHaveLength(1);
  });

  it("tracks treasure per character", () => {
    useCoin.getState().addTreasure("c1", "Ruby");
    expect(purseFor(useCoin.getState(), "c1").treasure[0].text).toBe("Ruby");
  });

  it("adopts the legacy purse into a character only once", () => {
    useCoin.setState({
      purses: { __legacy__: purse(200, [25]) },
    });
    useCoin.getState().adoptLegacyPurse("c1");
    expect(coinBalance(purseFor(useCoin.getState(), "c1"))).toBe(225);
    expect(useCoin.getState().purses.__legacy__).toBeUndefined();

    // Second call is a no-op (c1 already has a purse) and never clobbers it.
    useCoin.getState().setStartingGold("c1", 999);
    useCoin.getState().adoptLegacyPurse("c1");
    expect(purseFor(useCoin.getState(), "c1").startingGold).toBe(999);
  });
});

describe("magic items", () => {
  it("adds party and personal items newest-first and ignores blank names", () => {
    useCoin.getState().addPartyItem("c1", { name: "Ioun Stone", carrier: "Kael" });
    useCoin.getState().addPartyItem("c1", { name: "Climbing Rope", note: "50 ft" });
    useCoin.getState().addPartyItem("c1", { name: "   " });
    useCoin.getState().addPersonalItem("c1", { name: "Shadow Lute", note: "attuned" });

    const p = purseFor(useCoin.getState(), "c1");
    expect(p.partyItems.map((i) => i.name)).toEqual(["Climbing Rope", "Ioun Stone"]);
    expect(p.partyItems[1].carrier).toBe("Kael");
    expect(p.partyItems[0].carrier).toBe("");
    expect(p.personalItems[0].note).toBe("attuned");
  });

  it("updates a carrier and a note, and removes by id", () => {
    useCoin.getState().addPartyItem("c1", { name: "Ioun Stone", carrier: "Kael" });
    const id = purseFor(useCoin.getState(), "c1").partyItems[0].id;

    useCoin.getState().updatePartyItem("c1", id, { carrier: "Lynala" });
    useCoin.getState().updatePartyItem("c1", id, { note: "3 charges" });
    const item = purseFor(useCoin.getState(), "c1").partyItems[0];
    expect(item.carrier).toBe("Lynala");
    expect(item.note).toBe("3 charges");

    useCoin.getState().removePartyItem("c1", id);
    expect(purseFor(useCoin.getState(), "c1").partyItems).toHaveLength(0);
  });

  it("keeps each character's items separate", () => {
    useCoin.getState().addPartyItem("c1", { name: "Ioun Stone" });
    expect(purseFor(useCoin.getState(), "c2").partyItems).toHaveLength(0);
  });
});

describe("applyRemotePurse", () => {
  it("keeps local items when the remote purse predates them", () => {
    useCoin.getState().addPartyItem("c1", { name: "Ioun Stone" });
    useCoin.getState().addPersonalItem("c1", { name: "Shadow Lute" });

    // What a device on an older build pushes: no item arrays at all.
    const stale = { startingGold: 10, entries: [], treasure: [] } as unknown as Purse;
    useCoin.getState().applyRemotePurse("c1", stale);

    const p = purseFor(useCoin.getState(), "c1");
    expect(p.startingGold).toBe(10);
    expect(p.partyItems).toHaveLength(1);
    expect(p.personalItems).toHaveLength(1);
  });

  it("takes the remote items when the remote purse has them", () => {
    useCoin.getState().addPartyItem("c1", { name: "Local Item" });
    useCoin.getState().applyRemotePurse("c1", {
      startingGold: 0,
      entries: [],
      treasure: [],
      partyItems: [{ id: "r1", name: "Remote Item", note: "", carrier: "" }],
      personalItems: [],
    });
    expect(
      purseFor(useCoin.getState(), "c1").partyItems.map((i) => i.name),
    ).toEqual(["Remote Item"]);
  });
});

describe("migrateCoin", () => {
  it("carries a v1 global purse all the way to v3", () => {
    const v1 = {
      startingGold: 200,
      entries: [{ id: "a", amount: 25, note: "" }],
      treasure: [],
    };
    const legacy = migrateCoin(v1, 1).purses.__legacy__;
    expect(legacy.startingGold).toBe(200);
    expect(legacy.entries).toHaveLength(1);
    expect(legacy.partyItems).toEqual([]);
    expect(legacy.personalItems).toEqual([]);
  });

  it("backfills a v2 purse without touching its gold", () => {
    const v2 = { purses: { c1: { startingGold: 5, entries: [], treasure: [] } } };
    const out = migrateCoin(v2, 2);
    expect(out.purses.c1.startingGold).toBe(5);
    expect(out.purses.c1.partyItems).toEqual([]);
  });

  it("is idempotent — never wipes items already present", () => {
    // An older build re-stamps localStorage as v2, so this runs again over a
    // purse that already holds items.
    const withItems = {
      purses: {
        c1: {
          startingGold: 0,
          entries: [],
          treasure: [],
          partyItems: [{ id: "x", name: "Ioun Stone", note: "", carrier: "Kael" }],
          personalItems: [],
        },
      },
    };
    expect(migrateCoin(withItems, 2).purses.c1.partyItems).toHaveLength(1);
  });
});
