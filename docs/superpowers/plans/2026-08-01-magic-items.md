# Magic Items (Party + Personal) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two magic-item lists on the Coin page — party items that record which party member carries them, and personal items — persisted, synced, and safe against older devices pushing an older purse shape.

**Architecture:** The lists are two new arrays on the existing per-character `Purse`, so they ride the existing cloud-sync blob with no server change. Both fields are required, and stay honestly required because every foreign purse shape is normalised at exactly two choke points: the persist migration (localStorage) and a new `applyRemotePurse` action (cloud sync). The migration is extracted as a pure exported function because it is untestable through the store.

**Tech Stack:** React 18, Zustand 5 (+ persist), Vitest 4, Tailwind 3.

**Spec:** `docs/superpowers/specs/2026-08-01-magic-items-design.md`

## Global Constraints

- **No new test tooling.** No React Testing Library, no jsdom. Vitest runs in `node`: `window` is undefined and `useCoin.persist` is NOT attached — verified with a probe. Test pure functions and store actions only.
- **Never `?? []` inside a Zustand selector.** `purseFor` returns a frozen `EMPTY_PURSE` singleton so selector identity stays stable; a fresh `[]` per snapshot reintroduces the documented `getSnapshot` infinite-render loop (`src/store/coin.ts:38-48`). Select the purse once, derive lists in the component body.
- **`EMPTY_PURSE`'s freeze is shallow.** Never sort or push these arrays in place; copy first.
- **Copy is English** in `Coin.tsx` — the page is entirely English and must not end up half-Spanish. Code, comments and commit messages in English.
- **Commit after every task.** Branch `feat/magic-items`; never commit on `main`.
- Run `npm test` (script is `vitest run`) and `npm run build` (`tsc -b && vite build`, so tests are type-checked too).

---

### Task 1: `partyRoster` helper

Extracted first because both the new UI and `Combat.tsx` need it, and it is trivially testable under the no-jsdom convention.

**Files:**
- Create: `src/lib/partyRoster.ts`
- Test: `src/lib/partyRoster.test.ts`
- Modify: `src/views/Combat.tsx:74`

**Interfaces:**
- Produces: `partyRoster(c: Pick<Character, "name" | "party">): string[]`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { partyRoster } from "./partyRoster";

describe("partyRoster", () => {
  it("puts the character first, then the party", () => {
    expect(partyRoster({ name: "Brunella", party: ["Kael", "Lynala"] })).toEqual([
      "Brunella", "Kael", "Lynala",
    ]);
  });

  it("handles a character with no party", () => {
    expect(partyRoster({ name: "Brunella", party: undefined })).toEqual(["Brunella"]);
  });

  it("drops blank names", () => {
    expect(partyRoster({ name: "Brunella", party: ["", "  ", "Kael"] })).toEqual([
      "Brunella", "Kael",
    ]);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./partyRoster`.

- [ ] **Step 3: Implement**

```ts
import type { Character } from "@/types/character";

/**
 * The character plus their party, in display order — the roster used for combat
 * preload and for picking who carries a party item. Pure so it can be tested
 * without a DOM.
 */
export function partyRoster(c: Pick<Character, "name" | "party">): string[] {
  return [c.name, ...(c.party ?? [])]
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
}
```

- [ ] **Step 4: Use it in Combat.tsx**

Add the import, then replace line 74:

```tsx
    const roster = [character.name, ...(character.party ?? [])];
```

with:

```tsx
    const roster = partyRoster(character);
```

The `.filter((n) => n.trim())` on the next line becomes redundant but is harmless — leave the rest of that block alone.

- [ ] **Step 5: Verify**

Run: `npm test` → PASS (124 tests)
Run: `npm run build` → succeeds

- [ ] **Step 6: Commit**

```bash
git add src/lib/partyRoster.ts src/lib/partyRoster.test.ts src/views/Combat.tsx
git commit -m "refactor: extract partyRoster helper"
```

---

### Task 2: Purse gains the item lists, with both normalisers

The heart of the feature. Do not split — the type change, the migration and the existing-test fixes must land together or the build is red.

**Files:**
- Modify: `src/store/coin.ts`
- Modify: `src/store/coin.test.ts` (existing tests BREAK without this — see Step 1)

**Interfaces:**
- Produces: `MagicItem`, the two new `Purse` fields, `migrateCoin`, and the actions
  `addPartyItem`, `addPersonalItem`, `removePartyItem`, `removePersonalItem`,
  `updatePartyItem`, `updatePersonalItem`, `applyRemotePurse`.

- [ ] **Step 1: Fix the two existing tests that the type change breaks**

In `src/store/coin.test.ts`, the `purse()` helper (lines 9-13) builds a three-field
`Purse` — a type error once the fields are required. Add the arrays:

```ts
const purse = (startingGold: number, amounts: number[]): Purse => ({
  startingGold,
  entries: amounts.map((amount, i) => ({ id: String(i), amount, note: "" })),
  treasure: [],
  partyItems: [],
  personalItems: [],
});
```

And the `purseFor` test (lines 31-35) asserts `toEqual` against three keys — a runtime
failure once `EMPTY_PURSE` grows:

```ts
    expect(purseFor({ purses: {} }, "nobody")).toEqual({
      startingGold: 0,
      entries: [],
      treasure: [],
      partyItems: [],
      personalItems: [],
    });
```

- [ ] **Step 2: Write the failing tests for the new behaviour**

Append to `src/store/coin.test.ts`:

```ts
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
    const p = purseFor(useCoin.getState(), "c1");
    expect(p.partyItems.map((i) => i.name)).toEqual(["Remote Item"]);
  });
});

describe("migrateCoin", () => {
  it("carries a v1 global purse all the way to v3", () => {
    const v1 = { startingGold: 200, entries: [{ id: "a", amount: 25, note: "" }], treasure: [] };
    const out = migrateCoin(v1, 1);
    const legacy = out.purses.__legacy__;
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
    const out = migrateCoin(withItems, 2);
    expect(out.purses.c1.partyItems).toHaveLength(1);
  });
});
```

Add `migrateCoin` and `type MagicItem` to the imports at the top of the test file.

- [ ] **Step 3: Run to confirm they fail**

Run: `npm test`
Expected: FAIL — `migrateCoin` is not exported and the actions do not exist.

- [ ] **Step 4: Implement in `src/store/coin.ts`**

Add the type, after `TreasureItem`:

```ts
export interface MagicItem {
  id: string;
  name: string;
  /** Free text: what it does, charges, attunement… Editable in place. */
  note: string;
  /** Who carries it. `""` = unassigned. Only meaningful for party items. */
  carrier: string;
}
```

Extend `Purse` with `partyItems: MagicItem[];` and `personalItems: MagicItem[];`, and add
both to `emptyPurse()` and to the frozen `EMPTY_PURSE`.

Add the normaliser and the extracted migration, above `useCoin`:

```ts
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
 * undefined and zustand's persist never attaches `api.persist` — the migration
 * is unreachable through the store and can only be tested directly.
 *
 * Falls through, never returns early: a v1 store must pass through v2 AND v3.
 */
export function migrateCoin(persisted: unknown, version: number): CoinState {
  let state = persisted as CoinState;

  // v1 → v2: one global purse becomes the __legacy__ per-character purse,
  // which adoptLegacyPurse later moves onto the first active character.
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
    } as CoinState;
  }

  // v2 → v3: every purse gains the item lists.
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
```

Add a shared patch helper next to `patchPurse`:

```ts
function patchItem(
  list: MagicItem[],
  id: string,
  patch: Partial<Omit<MagicItem, "id">>,
): MagicItem[] {
  return list.map((i) => (i.id === id ? { ...i, ...patch } : i));
}

function makeItem(input: { name: string; note?: string; carrier?: string }): MagicItem {
  return {
    id: newId(),
    name: input.name.trim(),
    note: (input.note ?? "").trim(),
    carrier: input.carrier ?? "",
  };
}
```

Declare on `CoinState`:

```ts
  // Magic items — one action per list, matching addEntry/addTreasure. The
  // fields go in an options object so three adjacent strings can't be
  // transposed silently.
  addPartyItem: (cid: string, item: { name: string; note?: string; carrier?: string }) => void;
  addPersonalItem: (cid: string, item: { name: string; note?: string }) => void;
  removePartyItem: (cid: string, id: string) => void;
  removePersonalItem: (cid: string, id: string) => void;
  updatePartyItem: (cid: string, id: string, patch: Partial<Omit<MagicItem, "id">>) => void;
  updatePersonalItem: (cid: string, id: string, patch: Partial<Omit<MagicItem, "id">>) => void;
  /**
   * Write a purse pulled from cloud sync. Backfills item lists the remote
   * lacks from the LOCAL purse — a device on an older build pushes a purse
   * with no item arrays, and sync overwrites wholesale, so taking the remote
   * verbatim would silently delete every item everywhere.
   */
  applyRemotePurse: (cid: string, remote: Purse) => void;
```

Implement them:

```ts
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
```

Finally, bump the persist config and point it at the extracted function:

```ts
    {
      name: "arcanist-ledger:coin",
      // v2: single global purse → per-character purses.
      // v3: purses gain partyItems / personalItems.
      version: 3,
      migrate: migrateCoin,
    },
```

- [ ] **Step 5: Verify**

Run: `npm test` → PASS (all new tests green, and the two edited ones still pass)
Run: `npm run build` → succeeds

- [ ] **Step 6: Commit**

```bash
git add src/store/coin.ts src/store/coin.test.ts
git commit -m "feat: party and personal magic items in the coin store"
```

---

### Task 3: Stop cloud sync from deleting items

**Files:**
- Modify: `src/store/sync.ts:96`

- [ ] **Step 1: Route the pulled purse through the normaliser**

Replace:

```ts
        useCoin.setState((s) => ({ purses: { ...s.purses, [cid]: coin } }));
```

with:

```ts
        // NOT setState: a device on an older build pushes a purse with no item
        // arrays, and sync overwrites wholesale. applyRemotePurse backfills
        // them from the local purse so a stale peer can't delete items.
        useCoin.getState().applyRemotePurse(cid, coin);
```

Note `coin` is typed `Purse` at that point; no cast needed.

- [ ] **Step 2: Verify**

Run: `npm test` → PASS
Run: `npm run build` → succeeds

- [ ] **Step 3: Commit**

```bash
git add src/store/sync.ts
git commit -m "fix: don't let a stale peer's purse delete magic items"
```

---

### Task 4: The two sections on the Coin page

**Files:**
- Modify: `src/views/Coin.tsx`

- [ ] **Step 1: Wire the store and the roster**

Add imports:

```tsx
import { partyRoster } from "@/lib/partyRoster";
import type { MagicItem } from "@/store/coin";
```

In the component, next to the existing selectors:

```tsx
  const character = useCharacter((s) => s.character);
  const addPartyItem = useCoin((s) => s.addPartyItem);
  const addPersonalItem = useCoin((s) => s.addPersonalItem);
  const removePartyItem = useCoin((s) => s.removePartyItem);
  const removePersonalItem = useCoin((s) => s.removePersonalItem);
  const updatePartyItem = useCoin((s) => s.updatePartyItem);
  const updatePersonalItem = useCoin((s) => s.updatePersonalItem);
```

Derive the lists from the purse already selected — **never a second selector with `?? []`**:

```tsx
  const { startingGold, entries, treasure, partyItems, personalItems } = purse;
  const roster = partyRoster(character);
```

- [ ] **Step 2: Add the new row**

Immediately after the closing `</div>` of the existing `grid` block and before the
final `</div>`:

```tsx
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md items-start">
        <section className="space-y-sm">
          <SectionHeader icon="group" title="Party items" subtitle="Shared magic items and who carries them" />
          <ItemForm withCarrier roster={roster} onAdd={(name, note, carrier) => addPartyItem(cid, { name, note, carrier })} />
          {partyItems.length === 0 ? (
            <p className="text-outline text-sm italic px-1">No party items yet.</p>
          ) : (
            <ul className="space-y-1">
              {partyItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  roster={roster}
                  onCarrier={(carrier) => updatePartyItem(cid, item.id, { carrier })}
                  onNote={(note) => updatePartyItem(cid, item.id, { note })}
                  onRemove={() => removePartyItem(cid, item.id)}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-sm">
          <SectionHeader icon="auto_awesome" title="Personal items" subtitle="Carried by this character" />
          <ItemForm onAdd={(name, note) => addPersonalItem(cid, { name, note })} />
          {personalItems.length === 0 ? (
            <p className="text-outline text-sm italic px-1">No personal items yet.</p>
          ) : (
            <ul className="space-y-1">
              {personalItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onNote={(note) => updatePersonalItem(cid, item.id, { note })}
                  onRemove={() => removePersonalItem(cid, item.id)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
```

- [ ] **Step 3: Add the two sub-components at the bottom of the file**

Alongside `EntryForm` and `TreasureForm`:

```tsx
function ItemForm({
  withCarrier = false,
  roster = [],
  onAdd,
}: {
  withCarrier?: boolean;
  roster?: string[];
  onAdd: (name: string, note: string, carrier: string) => void;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name, note, carrier);
    setName("");
    setNote("");
    setCarrier("");
  };

  return (
    <form onSubmit={submit} className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-sm space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Item name…"
        className="input-inset w-full text-on-surface"
        aria-label="Item name"
      />
      <div className="flex gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (charges, attunement…)"
          className="input-inset flex-1 text-on-surface text-sm"
          aria-label="Item note"
        />
        {withCarrier && (
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="input-inset text-on-surface text-sm"
            aria-label="Carried by"
          >
            <option value="">Unassigned</option>
            {roster.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        )}
        <button type="submit" className="btn-brass shrink-0" aria-label="Add item">
          <Icon name="add" filled />
        </button>
      </div>
    </form>
  );
}

function ItemRow({
  item,
  roster,
  onCarrier,
  onNote,
  onRemove,
}: {
  item: MagicItem;
  roster?: string[];
  onCarrier?: (carrier: string) => void;
  onNote: (note: string) => void;
  onRemove: () => void;
}) {
  // A carrier can fall out of the roster (party edited, sync pull replaced it,
  // character re-imported). Keep it as an option or the select renders blank
  // and silently reads as unassigned.
  const options = roster ?? [];
  const dangling = item.carrier && !options.includes(item.carrier);

  return (
    <li className="bg-surface-container border border-outline-variant/30 rounded-lg px-sm py-2">
      <div className="flex items-center gap-2">
        <Icon name="auto_awesome" size={16} className="text-primary shrink-0" />
        <span className="text-sm text-on-surface flex-1 break-words">{item.name}</span>
        {onCarrier && (
          <select
            value={item.carrier}
            onChange={(e) => onCarrier(e.target.value)}
            className="input-inset text-xs text-on-surface shrink-0"
            aria-label={`Carried by, ${item.name}`}
          >
            <option value="">Unassigned</option>
            {options.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
            {dangling && (
              <option value={item.carrier}>{item.carrier} (not in party)</option>
            )}
          </select>
        )}
        <button onClick={onRemove} className="btn-icon shrink-0" aria-label={`Remove ${item.name}`}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <input
        type="text"
        value={item.note}
        onChange={(e) => onNote(e.target.value)}
        placeholder="Note…"
        className="mt-1 w-full bg-transparent border-none text-[11px] text-outline focus:text-on-surface focus:outline-none"
        aria-label={`Note for ${item.name}`}
      />
    </li>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm test` → PASS
Run: `npm run build` → succeeds

- [ ] **Step 5: Commit**

```bash
git add src/views/Coin.tsx
git commit -m "feat: party and personal magic item sections on the Coin page"
```

---

### Task 5: Browser verification

- [ ] **Step 1: DISABLE CLOUD SYNC IN THE TEST PROFILE FIRST**

A previous session's UI test wrote to real production data because sync was enabled in
the MCP Chrome profile. Before touching the UI:

```js
localStorage.setItem("al.sync.enabled", "0")
```

then reload. Confirm `al.sync.enabled` is `"0"` before editing anything.

- [ ] **Step 2: Exercise the feature**

On `http://localhost:5180/#/coin`:
1. Add a party item with a name, note and carrier → appears with the carrier selected.
2. Change the carrier from the row → persists.
3. Edit a note in place → persists.
4. Add a personal item; delete one item from each list.
5. Reload → everything survives; gold and treasure are untouched.

- [ ] **Step 3: Report**

Summarise what was verified and what was not. Do not claim the sync round-trip was
verified unless it actually was.

---

## Self-review notes

- **Spec coverage:** data model + both normalisers → Task 2; `applyRemotePurse` wired → Task 3; carrier roster + dangling carriers → Tasks 1 and 4; UI and layout → Task 4; AC 1-6 → Task 5; AC 7 → the `applyRemotePurse` tests in Task 2; AC 9 → verification steps in every task.
- **AC 8 (full sync round-trip) is NOT covered by an automated test** — it needs two profiles and a live server. Task 5 Step 3 requires saying so rather than implying it passed.
- **Test count:** 121 today → 124 after Task 1 → ~132 after Task 2.
- The riskiest change is the persist version bump. The idempotency test exists precisely because an older build re-stamping `version: 2` is a real scenario for this user, who has a tablet that lags behind.
