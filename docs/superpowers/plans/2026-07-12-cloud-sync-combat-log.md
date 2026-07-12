# Cloud Sync + Combat Log — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist finished combats (a "Crónica" log) and sync durable per-character state (abilities, gold, combat log) across the user's devices, offline-first, on free tiers only.

**Architecture:** Three phases, each independently shippable. (1) Local combat-log store + Crónica tab in `/combat`. (2) Refactor the global coin purse into per-character purses. (3) Cloud sync over Vercel serverless + Upstash Redis, shared-secret auth, last-write-wins for state and union-by-id for combats; `localStorage` stays the source of truth.

**Tech Stack:** React 18 + Vite + Zustand (v5) `persist`, react-router-dom v6, Vitest, Vercel serverless (Node), Upstash Redis.

## Global Constraints

- **Free-tier only** (hard): Upstash Redis free (~500K cmds/mo), Vercel Hobby. Verify current limits before Phase 3.
- Dev server port **5180**. Restart after Tailwind config changes.
- Zustand `persist`: bump store `version` + add `migrate` when persisted shape changes.
- Never commit on `main`; feature branch `feat/cloud-sync-combat-log`. Never push without asking.
- One Bash command per call (no `&&`/`;` chaining).
- Path alias `@/` → `src/`. Test files co-located as `*.test.ts` and run via `npm test` (`vitest run`).
- Narration transcript builder to reuse: `buildNarrationPayload(combatants, totalRounds, activeName)` in `@/lib/combatLog`.

---

## Phase 1 — Combat Log (local persistence + Crónica tab)

**File structure:**
- Create `src/types/combatLog.ts` — `CombatRecord` type.
- Create `src/lib/combatRecord.ts` — pure `buildCombatRecord()` snapshot helper.
- Create `src/store/combatLog.ts` — persisted Zustand store (save/list/remove).
- Create `src/store/combatLog.test.ts`, `src/lib/combatRecord.test.ts`.
- Modify `src/views/Combat.tsx` — tab switcher (Tracker | Crónica), save on narrate.
- Create `src/components/combat/ChronicleTab.tsx` — list + transcript + re-narrate + delete.

### Task 1.1: CombatRecord type + snapshot helper

**Files:**
- Create: `src/types/combatLog.ts`
- Create: `src/lib/combatRecord.ts`
- Test: `src/lib/combatRecord.test.ts`

**Interfaces:**
- Produces: `interface CombatRecord { id; characterId; endedAt; title?; rounds; combatants: Combatant[]; narration? }`
- Produces: `buildCombatRecord(input: { characterId: string; combatants: Combatant[]; rounds: number; endedAt: number; title?: string; narration?: string }): CombatRecord`

- [ ] **Step 1: Write the type** `src/types/combatLog.ts`

```ts
import type { Combatant } from "./combat";

/** An immutable snapshot of a finished combat, kept for the Chronicle log. */
export interface CombatRecord {
  /** Stable id — dedup key for the union merge in cloud sync. */
  id: string;
  /** Owning character (activeCharacterId at the time the fight ended). */
  characterId: string;
  /** ms epoch when the record was created. */
  endedAt: number;
  /** Optional player-supplied label; defaults derived from date in the UI. */
  title?: string;
  /** Rounds fought. */
  rounds: number;
  /** Snapshot of every combatant with their per-round actions + conditions. */
  combatants: Combatant[];
  /** Cached Brunella narration, if generated. */
  narration?: string;
}
```

- [ ] **Step 2: Write the failing test** `src/lib/combatRecord.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildCombatRecord } from "./combatRecord";
import type { Combatant } from "@/types/combat";

const combatants: Combatant[] = [
  { id: "a", name: "Brunella", kind: "pc", initiative: 18, conditions: [], actions: { 1: { acted: true, text: "sings" } } },
];

describe("buildCombatRecord", () => {
  it("snapshots the inputs into an immutable record", () => {
    const rec = buildCombatRecord({ characterId: "c1", combatants, rounds: 2, endedAt: 1000 });
    expect(rec.characterId).toBe("c1");
    expect(rec.rounds).toBe(2);
    expect(rec.endedAt).toBe(1000);
    expect(rec.combatants).toHaveLength(1);
    expect(rec.id).toBeTruthy();
  });

  it("deep-copies combatants so later mutation of the source does not leak in", () => {
    const src = structuredClone(combatants);
    const rec = buildCombatRecord({ characterId: "c1", combatants: src, rounds: 1, endedAt: 1 });
    src[0].name = "MUTATED";
    expect(rec.combatants[0].name).toBe("Brunella");
  });
});
```

- [ ] **Step 3: Run test, expect FAIL** — `npm test -- combatRecord`  → fails (module missing).

- [ ] **Step 4: Implement** `src/lib/combatRecord.ts`

```ts
import type { Combatant } from "@/types/combat";
import type { CombatRecord } from "@/types/combatLog";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Pure: snapshot a finished combat into an immutable CombatRecord (deep-copied). */
export function buildCombatRecord(input: {
  characterId: string;
  combatants: Combatant[];
  rounds: number;
  endedAt: number;
  title?: string;
  narration?: string;
}): CombatRecord {
  return {
    id: newId(),
    characterId: input.characterId,
    endedAt: input.endedAt,
    title: input.title,
    rounds: Math.max(1, input.rounds),
    combatants: structuredClone(input.combatants),
    narration: input.narration,
  };
}
```

- [ ] **Step 5: Run test, expect PASS** — `npm test -- combatRecord`

- [ ] **Step 6: Commit** — `git add src/types/combatLog.ts src/lib/combatRecord.ts src/lib/combatRecord.test.ts` then `git commit -m "feat: CombatRecord type + snapshot helper"`

### Task 1.2: Persisted combat-log store

**Files:**
- Create: `src/store/combatLog.ts`
- Test: `src/store/combatLog.test.ts`

**Interfaces:**
- Consumes: `CombatRecord`, `buildCombatRecord`.
- Produces: `useCombatLog` with `{ records: CombatRecord[]; save(input): CombatRecord; setNarration(id, text): void; remove(id): void; recordsFor(characterId): CombatRecord[] }` and selector `recordsForCharacter(records, id)`.

- [ ] **Step 1: Write the failing test** `src/store/combatLog.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useCombatLog, recordsForCharacter } from "./combatLog";
import type { Combatant } from "@/types/combat";

const combatants: Combatant[] = [
  { id: "a", name: "Brunella", kind: "pc", initiative: 18, conditions: [], actions: {} },
];

beforeEach(() => useCombatLog.setState({ records: [] }));

describe("useCombatLog", () => {
  it("saves a record newest-first and filters by character", () => {
    useCombatLog.getState().save({ characterId: "c1", combatants, rounds: 1, endedAt: 1 });
    useCombatLog.getState().save({ characterId: "c2", combatants, rounds: 1, endedAt: 2 });
    const recs = useCombatLog.getState().records;
    expect(recs).toHaveLength(2);
    expect(recs[0].endedAt).toBe(2); // newest first
    expect(recordsForCharacter(recs, "c1")).toHaveLength(1);
  });

  it("attaches narration by id", () => {
    const rec = useCombatLog.getState().save({ characterId: "c1", combatants, rounds: 1, endedAt: 1 });
    useCombatLog.getState().setNarration(rec.id, "Canté la balada.");
    expect(useCombatLog.getState().records[0].narration).toBe("Canté la balada.");
  });

  it("removes by id", () => {
    const rec = useCombatLog.getState().save({ characterId: "c1", combatants, rounds: 1, endedAt: 1 });
    useCombatLog.getState().remove(rec.id);
    expect(useCombatLog.getState().records).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL** — `npm test -- combatLog`

- [ ] **Step 3: Implement** `src/store/combatLog.ts`

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CombatRecord } from "@/types/combatLog";
import { buildCombatRecord } from "@/lib/combatRecord";

interface CombatLogState {
  records: CombatRecord[];
  save: (input: {
    characterId: string;
    combatants: CombatRecord["combatants"];
    rounds: number;
    endedAt: number;
    title?: string;
    narration?: string;
  }) => CombatRecord;
  setNarration: (id: string, narration: string) => void;
  remove: (id: string) => void;
}

/** Records for one character, newest first. Pure selector for reuse + tests. */
export function recordsForCharacter(records: CombatRecord[], characterId: string): CombatRecord[] {
  return records.filter((r) => r.characterId === characterId);
}

export const useCombatLog = create<CombatLogState>()(
  persist(
    (set) => ({
      records: [],
      save: (input) => {
        const rec = buildCombatRecord(input);
        set((s) => ({ records: [rec, ...s.records] }));
        return rec;
      },
      setNarration: (id, narration) =>
        set((s) => ({
          records: s.records.map((r) => (r.id === id ? { ...r, narration } : r)),
        })),
      remove: (id) => set((s) => ({ records: s.records.filter((r) => r.id !== id) })),
    }),
    { name: "arcanist-ledger:combat-log", version: 1 },
  ),
);
```

- [ ] **Step 4: Run test, expect PASS** — `npm test -- combatLog`

- [ ] **Step 5: Commit** — `git commit -m "feat: persisted combat-log store"`

### Task 1.3: Save the fight on narrate + Crónica tab UI

**Files:**
- Create: `src/components/combat/ChronicleTab.tsx`
- Modify: `src/views/Combat.tsx` (add `view` tab state; render tracker vs. chronicle; on narrate-open capture nothing, but on "End & narrate" success save a record — pass an `onSaved` callback to NarrationModal, or save at "End" click).
- Modify: `src/components/combat/NarrationModal.tsx` (accept optional `onNarrated(text: string)` to persist narration into the just-saved record).

**Interfaces:**
- Consumes: `useCombatLog`, `recordsForCharacter`, `buildNarrationPayload`, `useCharacter`, `useCombat`.

Design notes for the implementer:
- Add local state `const [view, setView] = useState<"tracker" | "chronicle">("tracker")` in `Combat.tsx`; render a two-button segmented control under the `SectionHeader`.
- "End & narrate" flow: when the user clicks it, first save a record via `useCombatLog.getState().save({ characterId: activeCharacterId ?? "custom", combatants, rounds: round, endedAt: Date.now() })`, keep the returned `id`, open `NarrationModal`; pass `onNarrated={(text) => useCombatLog.getState().setNarration(savedId, text)}` so the generated ballad is stored on the record. (Guard: only save when `hasNarratableActions(combatants)`.)
- `ChronicleTab`: reads `recordsForCharacter(useCombatLog(s=>s.records), activeCharacterId)`. For each record: title (or `new Date(endedAt).toLocaleString()`), rounds, a collapsible transcript via `buildNarrationPayload(record.combatants, record.rounds, name)`, the cached `narration` (if any) rendered like the modal's `<article>`, a "Re-narrate" button (reuse `NarrationModal` with the record's combatants), and a delete button (with `confirm`).
- Empty state: "Todavía no hay combates en la crónica."

- [ ] **Step 1:** Add `onNarrated?: (text: string) => void` prop to `NarrationModal`; call it in `generate()` right after `setText(result)`.
- [ ] **Step 2:** Add tab state + segmented control to `Combat.tsx`; wrap the existing tracker JSX in `view === "tracker"` and render `<ChronicleTab />` when `view === "chronicle"`.
- [ ] **Step 3:** Implement the save-on-narrate flow (save record, track `savedRecordId`, wire `onNarrated`).
- [ ] **Step 4:** Implement `ChronicleTab.tsx` (list, transcript, cached narration, re-narrate, delete).
- [ ] **Step 5:** Typecheck — `npm run typecheck` (expect clean).
- [ ] **Step 6:** Run full test suite — `npm test` (expect all pass).
- [ ] **Step 7: Verify in the app** — `/run` skill or `npm run dev` on 5180: run a mock fight, record actions, End & narrate, confirm it appears under Crónica and survives a reload.
- [ ] **Step 8: Commit** — `git commit -m "feat: Crónica tab — persist and browse finished combats"`

---

## Phase 2 — Coin per-character

**File structure:**
- Modify `src/store/coin.ts` — keyed purses `Record<characterId, Purse>`, active-purse selectors, v2 migration.
- Modify `src/views/Coin.tsx` — read/write the active character's purse.
- Modify `src/store/coin.test.ts` — cover per-character + migration.

### Task 2.1: Refactor coin store to per-character purses

**Files:**
- Modify: `src/store/coin.ts`
- Test: `src/store/coin.test.ts`

**Interfaces:**
- Produces: `interface Purse { startingGold: number; entries: CoinEntry[]; treasure: TreasureItem[] }`
- Produces: `useCoin` state `{ purses: Record<string, Purse> }` + actions now taking `(characterId, …)`: `setStartingGold(cid, gold)`, `addEntry(cid, amount, note)`, `removeEntry(cid, id)`, `addTreasure(cid, text)`, `removeTreasure(cid, id)`.
- Produces: selector `purseFor(state, characterId): Purse` (returns an empty purse default if absent).
- Migration v1→v2: wrap the old flat `{ startingGold, entries, treasure }` into `purses["__legacy__"]`; the store also exposes `adoptLegacyPurse(characterId)` to move `__legacy__` into the active character on first load (called once from `Coin.tsx`/app boot when a real `activeCharacterId` exists and no purse for it yet).

Implementation (full store):

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CoinEntry { id: string; amount: number; note: string; }
export interface TreasureItem { id: string; text: string; }
export interface Purse { startingGold: number; entries: CoinEntry[]; treasure: TreasureItem[]; }

const LEGACY = "__legacy__";
const emptyPurse = (): Purse => ({ startingGold: 0, entries: [], treasure: [] });

interface CoinState {
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
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function purseFor(state: { purses: Record<string, Purse> }, cid: string): Purse {
  return state.purses[cid] ?? emptyPurse();
}

export function coinBalance(purse: Purse): number {
  return purse.entries.reduce((sum, e) => sum + e.amount, purse.startingGold);
}

function patchPurse(purses: Record<string, Purse>, cid: string, fn: (p: Purse) => Purse) {
  const cur = purses[cid] ?? emptyPurse();
  return { ...purses, [cid]: fn(cur) };
}

export const useCoin = create<CoinState>()(
  persist(
    (set) => ({
      purses: {},
      setStartingGold: (cid, gold) =>
        set((s) => ({ purses: patchPurse(s.purses, cid, (p) => ({ ...p, startingGold: Math.round(Number.isFinite(gold) ? gold : 0) })) })),
      addEntry: (cid, amount, note) =>
        set((s) => {
          const amt = Math.round(amount);
          if (!amt) return s;
          return { purses: patchPurse(s.purses, cid, (p) => ({ ...p, entries: [{ id: newId(), amount: amt, note: note.trim() }, ...p.entries] })) };
        }),
      removeEntry: (cid, id) =>
        set((s) => ({ purses: patchPurse(s.purses, cid, (p) => ({ ...p, entries: p.entries.filter((e) => e.id !== id) })) })),
      addTreasure: (cid, text) =>
        set((s) => {
          const t = text.trim();
          if (!t) return s;
          return { purses: patchPurse(s.purses, cid, (p) => ({ ...p, treasure: [{ id: newId(), text: t }, ...p.treasure] })) };
        }),
      removeTreasure: (cid, id) =>
        set((s) => ({ purses: patchPurse(s.purses, cid, (p) => ({ ...p, treasure: p.treasure.filter((t) => t.id !== id) })) })),
      adoptLegacyPurse: (cid) =>
        set((s) => {
          const legacy = s.purses[LEGACY];
          if (!legacy || s.purses[cid]) return s;
          const { [LEGACY]: _drop, ...rest } = s.purses;
          return { purses: { ...rest, [cid]: legacy } };
        }),
    }),
    {
      name: "arcanist-ledger:coin",
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2 && persisted && typeof persisted === "object") {
          const old = persisted as { startingGold?: number; entries?: CoinEntry[]; treasure?: TreasureItem[] };
          return {
            purses: {
              [LEGACY]: {
                startingGold: old.startingGold ?? 0,
                entries: old.entries ?? [],
                treasure: old.treasure ?? [],
              },
            },
          } as CoinState;
        }
        return persisted as CoinState;
      },
    },
  ),
);
```

- [ ] **Step 1:** Rewrite `src/store/coin.test.ts` for the new signatures + a v1→v2 migration test (feed a legacy blob to `migrate` and assert it lands in `purses.__legacy__`; then `adoptLegacyPurse("c1")` moves it).
- [ ] **Step 2:** Run test, expect FAIL — `npm test -- coin`
- [ ] **Step 3:** Replace `src/store/coin.ts` with the implementation above.
- [ ] **Step 4:** Run test, expect PASS — `npm test -- coin`
- [ ] **Step 5: Commit** — `git commit -m "refactor: per-character coin purses with v2 migration"`

### Task 2.2: Update Coin view consumers

**Files:**
- Modify: `src/views/Coin.tsx`

- [ ] **Step 1:** Read `activeCharacterId` from `useCharacter`; compute `cid = activeCharacterId ?? "custom"`. On mount `useEffect(() => useCoin.getState().adoptLegacyPurse(cid), [cid])`.
- [ ] **Step 2:** Replace store reads with `const purse = useCoin((s) => purseFor(s, cid))`; derive `balance = coinBalance(purse)`; iterate `purse.entries` / `purse.treasure`.
- [ ] **Step 3:** Update all action calls to pass `cid` first (`addEntry(cid, ...)`, etc.).
- [ ] **Step 4:** Typecheck + full tests — `npm run typecheck`, then `npm test`.
- [ ] **Step 5: Verify in app** — add income/expense/treasure, reload, switch character via library, confirm purses are separate and the pre-existing purse followed the previously-active character.
- [ ] **Step 6: Commit** — `git commit -m "feat: Coin view uses the active character's purse"`

---

## Phase 3 — Cloud sync (Vercel + Upstash Redis, offline-first)

**Pre-req:** verify Upstash free tier + create an Upstash Redis DB via Vercel; set env vars `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `SYNC_SECRET` in Vercel (Production + Preview). Document in README.

**File structure:**
- Create `src/lib/syncMerge.ts` (+ test) — pure `mergeState`, `mergeCombats`.
- Create `src/lib/durableSheet.ts` (+ test) — extract/apply the synced Character subset.
- Create `src/lib/syncConfig.ts` — secret + enabled flag in localStorage.
- Create `src/lib/syncApi.ts` — fetch wrappers (`getRemote`, `putState`, `postCombat`).
- Create `src/store/sync.ts` — `useSync` orchestration store (status, push debounce, pull).
- Create `api/sync/[characterId].ts` — Vercel serverless GET/PUT handler.
- Modify `src/views/Settings.tsx` — sync section.
- Modify `src/main.tsx` — kick off pull on boot + `focus`/`online` listeners.

### Task 3.1: Pure merge logic

**Files:** Create `src/lib/syncMerge.ts`, `src/lib/syncMerge.test.ts`

**Interfaces:**
- Produces: `interface SyncedState { updatedAt: number; sheet: unknown; coin: unknown }`
- Produces: `mergeState(local: SyncedState | null, remote: SyncedState | null): SyncedState | null` — larger `updatedAt` wins; nulls handled.
- Produces: `mergeCombats(local: CombatRecord[], remote: CombatRecord[]): CombatRecord[]` — union by `id`, first-seen wins, sorted by `endedAt` desc.

- [ ] **Step 1: Failing test** covering: remote newer wins; local newer wins; either null; combats union dedups by id and sorts desc.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement (LWW compare on `updatedAt`; `Map` union keyed by `id` seeded with local then filling missing from remote; sort by `endedAt` desc).
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: pure sync merge (LWW state, union combats)"`

### Task 3.2: Durable sheet extract/apply

**Files:** Create `src/lib/durableSheet.ts`, `src/lib/durableSheet.test.ts`

**Interfaces:**
- Produces: `interface DurableSheet { abilities; hpMax; armor?; party; level; proficiencyBonus }`
- Produces: `extractDurable(c: Character): DurableSheet`
- Produces: `applyDurable(c: Character, d: DurableSheet): Character` — returns a new Character with only durable fields replaced (leaves volatile session state — `hp.current`, `spellSlots`, `resources`, `conditions`, `hitDice.spent`, `concentration`, `racialFreeCastsUsed` — untouched).

- [ ] **Step 1: Failing test:** extract picks the 6 durable fields; apply replaces abilities/gold-independent sheet fields but preserves `hp.current`, `spellSlots`, `conditions`.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: durable-sheet extract/apply for sync"`

### Task 3.3: Sync config + API client

**Files:** Create `src/lib/syncConfig.ts`, `src/lib/syncApi.ts` (+ `syncApi.test.ts` with mocked `fetch`)

**Interfaces:**
- `syncConfig.ts`: `getSecret(): string`, `setSecret(v): void`, `isSyncEnabled(): boolean`, `setSyncEnabled(b): void`, `getLastSynced(): number | null`, `setLastSynced(ms): void` (localStorage keys `al.sync.*`).
- `syncApi.ts` (all take `characterId` + read secret; return typed results; throw on non-2xx):
  - `getRemote(characterId): Promise<{ state: SyncedState | null; combats: CombatRecord[] }>`
  - `putState(characterId, state: SyncedState): Promise<void>`
  - `postCombat(characterId, record: CombatRecord): Promise<void>`
  - Each sends `Authorization: Bearer <secret>`; base path `/api/sync/${encodeURIComponent(characterId)}`.

- [ ] **Step 1: Failing test** for `syncApi` (mock `global.fetch`): asserts the `Authorization` header, URL, and method for each call; throws on 401.
- [ ] **Step 2:** FAIL → **Step 3:** implement both files → **Step 4:** PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: sync config + API client"`

### Task 3.4: Serverless sync handler

**Files:** Create `api/sync/[characterId].ts`

Self-contained (no `src/` imports, like `api/narrate.ts`). Uses Upstash REST via `fetch` (`UPSTASH_REDIS_REST_URL` + token) — GET/SET/`get` of two keys `char:{id}:state` and `char:{id}:combats`.

- **Auth:** reject if `Authorization` header !== `Bearer ${process.env.SYNC_SECRET}` → 401.
- **GET** `/api/sync/[characterId]` → `{ state, combats }` (parse stored JSON; default `null` / `[]`).
- **PUT** body `{ state?: SyncedState; combat?: CombatRecord }`:
  - if `state`: read existing; **write only if** incoming `updatedAt >= existing.updatedAt` (LWW) — else 200 no-op.
  - if `combat`: read combats array; append only if `id` not present (idempotent); write back.
  - return `{ ok: true }`.
- Validate `characterId` present; 400 otherwise. 405 for other methods.

- [ ] **Step 1:** Implement the handler (mirror `api/narrate.ts` Req/Res shapes + Upstash REST calls). Include a small helper to read/write a key via Upstash `GET`/`SET` REST endpoints.
- [ ] **Step 2:** Typecheck — `npm run typecheck`.
- [ ] **Step 3: Commit** — `git commit -m "feat: serverless sync handler (Upstash, shared-secret auth, LWW + idempotent combats)"`

### Task 3.5: Sync orchestration store

**Files:** Create `src/store/sync.ts`

**Interfaces:**
- Produces: `useSync` `{ status: "idle"|"syncing"|"ok"|"error"|"offline"; lastError?: string; pushState(): void (debounced); pushCombat(record): Promise<void>; pull(): Promise<void> }`
- Wiring: subscribes to `useCharacter` + `useCoin` changes → debounced `pushState` (builds `SyncedState { updatedAt: Date.now(), sheet: extractDurable(character), coin: purseFor(coin, cid) }`, calls `putState`). `pull()` calls `getRemote`, and if remote state newer → `useCharacter.getState().loadCharacter(applyDurable(current, remote.sheet), { sourceId: cid })`-style apply (or a narrower setter to avoid clobbering volatile state) + hydrate coin purse; union combats into `useCombatLog`.

Design notes:
- Guard everything behind `isSyncEnabled() && getSecret()`; otherwise no-op.
- Debounce `pushState` ~1500ms. On failure set `status:"error"`/`"offline"`, never throw to UI.
- Apply order in `pull`: compute merged state via `mergeState`; if merged is remote, apply durable sheet + coin; always `mergeCombats` and set `useCombatLog` records.
- Add subscriptions in `pushState` triggers: call `useSync.getState().pushState()` from a `useCharacter.subscribe` + `useCoin.subscribe` registered once in `src/store/sync.ts` module init.

- [ ] **Step 1:** Implement `useSync` with the debounce + guards. (Unit-test the debounce/guard logic with mocked `syncApi` if practical; otherwise cover merge paths via 3.1/3.2 tests and keep this thin.)
- [ ] **Step 2:** Typecheck + tests — `npm run typecheck`, `npm test`.
- [ ] **Step 3: Commit** — `git commit -m "feat: sync orchestration store (debounced push, pull-hydrate)"`

### Task 3.6: Settings UI + boot wiring

**Files:** Modify `src/views/Settings.tsx`, `src/main.tsx`

- [ ] **Step 1:** Settings "Cloud sync" section: secret input (password), enable toggle, "Sync now" button (`useSync.getState().pull()` then `pushState()`), status + last-synced (`getLastSynced()`), and a one-line security note ("Se guarda local; alcanza para un solo usuario").
- [ ] **Step 2:** `main.tsx`: on boot, if sync enabled, call `useSync.getState().pull()`; add `window.addEventListener("focus", …)` and `("online", …)` → `pull()` (throttled). Remove nothing existing.
- [ ] **Step 3:** Wire `pushCombat` into the save-on-narrate flow (Phase 1 Task 1.3) so a newly saved record is also pushed when sync is on.
- [ ] **Step 4:** Typecheck + full tests — `npm run typecheck`, `npm test`.
- [ ] **Step 5: Verify** — with env vars set (or a local mock), enable sync, edit an ability, confirm a `PUT` fires; on a second browser profile with the same secret, `Sync now` pulls the change. Confirm offline (DevTools offline) never blocks the UI.
- [ ] **Step 6: Commit** — `git commit -m "feat: cloud-sync Settings UI + boot pull/focus wiring"`

---

## Self-Review (coverage vs. spec)

- Cross-device sync → Phase 3 (3.1–3.6). ✓
- Multi-character, keyed by `activeCharacterId` → Phase 2 purses + Phase 3 keys. ✓
- Offline-first (localStorage source of truth, background sync, non-blocking) → 3.5 guards + 3.6 boot/focus. ✓
- Vercel + Upstash + shared secret → 3.4. ✓
- Durable vs volatile split → 3.2 `extractDurable`/`applyDurable`. ✓
- Combat log durable + Crónica tab in `/combat` → Phase 1. ✓
- Coin per-character + migration → Phase 2. ✓
- LWW state / union combats → 3.1 + 3.4. ✓
- Free-tier only → Global Constraints + 3 pre-req verification. ✓
- Tests: pure merge (3.1), durable (3.2), combat-log store (1.2), snapshot (1.1), coin migration (2.1), syncApi (3.3). ✓
