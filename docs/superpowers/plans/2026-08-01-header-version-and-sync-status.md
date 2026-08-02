# Header Version + Sync State — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Show the running build and the true sync state in the header on every page, and make every sync action explicit, honest and clock-free.

**Architecture:** The server becomes the only clock and the only authority on whether a write happened (compare-and-set on `baseUpdatedAt`, server-side `updatedAt`, `applied` in the response). The client decides "do I have unsaved work?" by comparing a **content digest**, not timestamps, so a device with no recorded baseline is pessimistically dirty — which is what makes the tablet's `hpMax: 28` recoverable. All header logic lives in pure functions because the header imports `virtual:pwa-register` and cannot run under Vitest.

**Spec:** `docs/superpowers/specs/2026-08-01-header-version-and-sync-status-design.md`

## Global Constraints

- No RTL, no jsdom. Vitest runs in `node`: `window` is undefined, so `isSyncEnabled()` and `setLastSynced()` are silent no-ops. Store tests **must** `vi.mock("@/lib/syncConfig")` as `src/lib/syncApi.test.ts` already does, or they pass vacuously.
- `tsc` is the only type gate — `npm test` does not typecheck. Always run `npm run build` too.
- Never `?? []` or a fresh object/array inside a Zustand selector (getSnapshot loop).
- Header copy: the topbar is English-neutral; use icons + short English labels (`Save`, `Fetch`) to match the page furniture.
- Branch `feat/header-version-and-sync-status`. Never commit on `main`. Never push without asking.

---

### Task 1: Pure sync logic (digest, flags, header state)

**Files:** Create `src/lib/syncFlags.ts`, `src/lib/syncFlags.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { digestState, syncFlags, syncHeaderState } from "./syncFlags";

describe("digestState", () => {
  it("is stable regardless of key order", () => {
    expect(digestState({ a: 1, b: [1, 2] })).toBe(digestState({ b: [1, 2], a: 1 }));
  });
  it("differs when content differs", () => {
    expect(digestState({ hpMax: 28 })).not.toBe(digestState({ hpMax: 33 }));
  });
});

describe("syncFlags", () => {
  const base = { baseline: "x", current: "x", lastAppliedUpdatedAt: 5, remoteUpdatedAt: 5, enabled: true };

  it("is clean when the digest matches and stamps agree", () => {
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

  it("reports nothing when sync is disabled", () => {
    expect(syncFlags({ ...base, baseline: null, remoteUpdatedAt: 9, enabled: false }))
      .toEqual({ dirty: false, remoteAhead: false });
  });
});

describe("syncHeaderState", () => {
  const d = { status: "idle" as const, dirty: false, remoteAhead: false, enabled: true, hasCharacter: true };

  it("hides the region when sync is off or no character is active", () => {
    expect(syncHeaderState({ ...d, enabled: false }).kind).toBe("hidden");
    expect(syncHeaderState({ ...d, hasCharacter: false }).kind).toBe("hidden");
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
    const s = syncHeaderState({ ...d, status: "error", message: "boom" });
    expect(s).toEqual({ kind: "error", message: "boom" });
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npm test`, cannot resolve `./syncFlags`)

- [ ] **Step 3: Implement**

```ts
import type { SyncStatus } from "@/store/sync";

/** Stable stringify: object keys sorted, so key order never changes the digest. */
function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
}

/**
 * Digest of the durable payload. Content-based on purpose: "do I have unsaved
 * work?" must not depend on any device clock, and a device that has never
 * recorded a baseline must read as dirty rather than clean.
 */
export function digestState(payload: unknown): string {
  const s = stable(payload);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13);
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}-${s.length.toString(36)}`;
}

export function syncFlags(a: {
  baseline: string | null;
  current: string;
  lastAppliedUpdatedAt: number | null;
  remoteUpdatedAt: number | null;
  enabled: boolean;
}): { dirty: boolean; remoteAhead: boolean } {
  if (!a.enabled) return { dirty: false, remoteAhead: false };
  return {
    // No baseline → this device has never confirmed a sync. Pessimistically
    // dirty: offering "Save" can only add data, offering nothing can lose it.
    dirty: a.baseline === null || a.baseline !== a.current,
    // Equality, not ordering: both stamps come from the SERVER's clock.
    remoteAhead:
      a.remoteUpdatedAt !== null && a.remoteUpdatedAt !== a.lastAppliedUpdatedAt,
  };
}

export type HeaderSync =
  | { kind: "hidden" }
  | { kind: "synced" }
  | { kind: "save" }
  | { kind: "fetch" }
  | { kind: "conflict" }
  | { kind: "busy" }
  | { kind: "error"; message: string };

export function syncHeaderState(a: {
  status: SyncStatus;
  dirty: boolean;
  remoteAhead: boolean;
  enabled: boolean;
  hasCharacter: boolean;
  message?: string;
}): HeaderSync {
  if (!a.enabled || !a.hasCharacter) return { kind: "hidden" };
  if (a.status === "syncing") return { kind: "busy" };
  if (a.status === "error" || a.status === "offline") {
    return { kind: "error", message: a.message ?? "Sync error" };
  }
  if (a.dirty && a.remoteAhead) return { kind: "conflict" };
  if (a.dirty) return { kind: "save" };
  if (a.remoteAhead) return { kind: "fetch" };
  return { kind: "synced" };
}
```

- [ ] **Step 4:** `npm test` → PASS. `npm run build` → succeeds.
- [ ] **Step 5: Commit** `feat: pure sync flag and header-state logic`

---

### Task 2: Server — compare-and-set, server clock, honest response

**Files:** `api/sync.ts`

- [ ] **Step 1: Replace the PUT state branch**

```ts
    if (req.method === "PUT") {
      const body: {
        state?: SyncedState;
        combat?: CombatRecord;
        baseUpdatedAt?: number | null;
        force?: boolean;
      } = typeof req.body === "string" ? JSON.parse(req.body || "{}") : ((req.body as never) ?? {});

      let applied: boolean | undefined;
      let stamp: number | undefined;

      if (body.state) {
        const existing = await readJson<SyncedState | null>(stateKey, null);
        // Optimistic concurrency: write when nothing exists, when the client
        // based its edit on exactly what we hold, or when the user forced it
        // after seeing the conflict. NO client clock is compared — the server
        // stamps the write itself, so device clocks can't order anything.
        const ok = !existing || body.baseUpdatedAt === existing.updatedAt || body.force === true;
        if (ok) {
          stamp = Date.now();
          await writeJson(stateKey, { ...body.state, updatedAt: stamp });
          applied = true;
        } else {
          stamp = existing.updatedAt;
          applied = false;
        }
      }

      if (body.combat && body.combat.id) {
        const combats = await readJson<CombatRecord[]>(combatsKey, []);
        if (!combats.some((c) => c.id === body.combat!.id)) {
          combats.push(body.combat);
          await writeJson(combatsKey, combats);
        }
      }

      // `applied`/`updatedAt` are omitted when the request carried no state, so
      // a combat-only PUT never reads as a rejected state write.
      res.status(200).json({ ok: true, ...(applied === undefined ? {} : { applied, updatedAt: stamp }) });
      return;
    }
```

Update the file header comment: the guard is now compare-and-set with a server-side stamp, and the response reports what happened. Note the known limitation: read-then-write is not atomic; acceptable for a single-user app.

- [ ] **Step 2:** `npm run build` → succeeds. Commit `fix: compare-and-set sync writes and report what actually happened`

---

### Task 3: Client transport + config keys

**Files:** `src/lib/syncApi.ts`, `src/lib/syncConfig.ts`, `src/lib/syncApi.test.ts`

- [ ] **Step 1: `putState` returns the server's verdict**

```ts
export interface PutResult {
  /** `undefined` = legacy deployment with no compare-and-set. Treat as applied. */
  applied?: boolean;
  updatedAt?: number;
}

export async function putState(
  characterId: string,
  state: SyncedState,
  opts: { baseUpdatedAt: number | null; force?: boolean },
  signal?: AbortSignal,
): Promise<PutResult> {
  const res = await fetch(base(characterId), {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ state, baseUpdatedAt: opts.baseUpdatedAt, force: opts.force === true }),
    signal,
  });
  await ensureOk(res);
  return (await res.json().catch(() => ({}))) as PutResult;
}
```

Adjust the existing `putState` call sites and its test in `src/lib/syncApi.test.ts` for the new argument.

- [ ] **Step 2: New config keys in `src/lib/syncConfig.ts`**

```ts
const KEY_BASELINE = "al.sync.baseline";
const KEY_APPLIED = "al.sync.appliedUpdatedAt";

/** Digest of the durable payload as of the last confirmed write or apply. */
export function getBaseline(): string | null { return read(KEY_BASELINE); }
export function setBaseline(d: string): void { write(KEY_BASELINE, d); }

/** Server stamp this device last applied or successfully wrote. */
export function getAppliedUpdatedAt(): number | null {
  const n = Number(read(KEY_APPLIED));
  return Number.isFinite(n) && read(KEY_APPLIED) !== null ? n : null;
}
export function setAppliedUpdatedAt(ms: number): void { write(KEY_APPLIED, String(ms)); }
```

Keep `getLastSynced`/`setLastSynced` for the "Última sync" display in Settings.

- [ ] **Step 3:** `npm test`, `npm run build` → green. Commit `feat: sync transport reports the server verdict`

---

### Task 4: Sync store — checkRemote / pullNow / pushNow

**Files:** `src/store/sync.ts`, `src/store/sync.test.ts` (new)

- [ ] **Step 1: Write the failing store tests** with `vi.mock("@/lib/syncConfig")` and `vi.mock("@/lib/syncApi")`:

```ts
// pushNow keeps the baseline unset when the server refuses
it("does not record a baseline when the server reports applied:false", async () => { … });
// legacy server (no `applied` field) counts as applied
it("treats a missing applied field as success", async () => { … });
// checkRemote records the stamp and merges combats but touches no sheet
it("checkRemote records remoteUpdatedAt and leaves the character store alone", async () => { … });
```

- [ ] **Step 2: Rework the store**

- `SyncStatus` gains `"conflict"`.
- State gains `remoteUpdatedAt: number | null`, `baseline: string | null`, `appliedUpdatedAt: number | null`, `dirty: boolean`, `remoteAhead: boolean`, and a `recompute()` that recalculates the flags via `syncFlags`.
- `currentDigest()` = `digestState({ sheet: extractDurable(character), coin: purseFor(coin, cid) })`.
- `checkRemote()`: `if (!isSyncEnabled() || activeCharacterId === null) return;` → GET → `set({ remoteUpdatedAt: remote?.updatedAt ?? null })` → **merge combats** (immutable, union) → `recompute()`. Does **not** touch `hydrating` and applies no sheet or purse.
- `pullNow()`: GET → `hydrating = true` in `try/finally` → apply sheet + `applyRemotePurse` + merge combats → `setAppliedUpdatedAt(remote.updatedAt)`, `setBaseline(currentDigest())` → `recompute()`.
- `pushNow(opts?: { force?: boolean })`: PUT with `baseUpdatedAt: getAppliedUpdatedAt()` and `force`. On `applied === false` → `set({ status: "conflict", remoteUpdatedAt: result.updatedAt })`, **no baseline write**. Otherwise → `setAppliedUpdatedAt(result.updatedAt ?? Date.now())`, `setBaseline(digest of what was sent)`, `setLastSynced(...)`, status `ok`.
- `pushStateDebounced()` keeps existing behaviour but returns early when `remoteAhead` is true, and routes through `pushNow()` **without** force.
- **Delete `syncNow`.**
- The two subscriptions call `recompute()` (cheap: a digest of the durable projection) instead of only scheduling a push.

- [ ] **Step 3:** `npm test`, `npm run build` → green. Commit `feat: explicit check/pull/push with content-based dirty tracking`

---

### Task 5: Header UI

**Files:** Create `src/components/HeaderStatus.tsx`; modify `src/components/AppShell.tsx`, `src/components/settings/CloudSyncSettings.tsx`; delete `src/components/UpdateBar.tsx`

- [ ] **Step 1: `HeaderStatus.tsx`** — renders the version line (or `Actualizar` when `needRefresh`), plus the sync affordance from `syncHeaderState`. Buttons: `↑ Save` → `pushNow({ force: true })`, `↓ Fetch` → `pullNow()`. Icon-only below `md`, `aria-label` on every control, wrapped in `role="status"`.
- [ ] **Step 2: Mount in `AppShell`** in the topbar's left slot, replacing the `hidden md:block` spacer, and under the mobile brand. Remove the `<UpdateBar />` mount and delete the file.
- [ ] **Step 3: `CloudSyncSettings`** — the button becomes "Comprobar" → `checkRemote()`; `StatusPill` gains a `conflict` entry (amber, "Conflicto").
- [ ] **Step 4:** `npm test`, `npm run build` → green. Commit `feat: version and sync state in the header on every page`

---

### Task 6: Boot wiring and verification

**Files:** `src/main.tsx`

- [ ] **Step 1:** boot / `focus` / `online` call `checkRemote()` instead of `pull()`, same throttle. Add a re-check when `activeCharacterId` changes (subscribe to `useCharacter`, compare the id, clear `remoteUpdatedAt` on change).
- [ ] **Step 2:** `npm test`, `npm run build` → green.
- [ ] **Step 3: Browser verification — DISABLE SYNC IN THE PROFILE FIRST** (`localStorage.setItem("al.sync.enabled","0")`), then re-enable deliberately for the sync checks against a scratch character id, never `brunella`.
  Verify: version renders on every page and both breakpoints; a device with no baseline shows **Save**; Save makes the server stamp advance; Fetch applies; both flags → both buttons; disabled sync → version only.
- [ ] **Step 4: Commit**, then report what was verified and what was not.

---

## Self-review notes

- **The tablet's recovery** depends on Task 1's null-baseline rule and Task 2's `force`. Those two must ship together or the recovery does not exist.
- **Not covered by automated tests:** ACs 1-5 and 9 (all UI), and the real two-device round trip.
- Task 4 is the risky one: it rewrites the store every other feature leans on. Keep the existing `pull`'s `hydrating` discipline verbatim rather than reinventing it.
