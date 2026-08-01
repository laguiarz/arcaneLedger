# Visible App Version + Editable Max HP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show which build is running (traceable to a commit), prompt when a newer build exists, and make max HP editable from the HP panel.

**Architecture:** The version is injected at build time through Vite's `define` (commit from Vercel's env var or local git, plus an ISO timestamp) and rendered by a pure formatter. The service worker moves from silent auto-update to an explicit prompt, registered by hand so a periodic `update()` check can be attached — that check is what stops an always-open PWA from sitting on a stale precache. Max HP needs no new state: the store action already exists and cloud sync already pushes character changes.

**Tech Stack:** React 18, Zustand 5, Vite 5, vite-plugin-pwa 1.2 (Workbox `generateSW`), Vitest 4, Tailwind 3.

**Spec:** `docs/superpowers/specs/2026-08-01-app-version-and-hp-edit-design.md`

## Global Constraints

- **No new test tooling.** The project has no React Testing Library and no jsdom. All 115 existing tests are pure logic / store tests. Do not add RTL, jsdom, or `environment: "jsdom"`. Component behaviour is verified manually on a preview deploy.
- **Theme-aware styling only.** Use the existing semantic Tailwind tokens (`text-primary`, `bg-surface-container`, `text-on-surface-variant`, `border-outline-variant/30`, …). Never hardcode a hex colour — the light/dark refactor drives everything through CSS variables.
- **Section markup pattern** for anything added to Settings, copied from `CloudSyncSettings.tsx`:
  `<section className="bg-surface-container border border-outline-variant/30 rounded-xl p-md relative overflow-hidden">` wrapping `<div className="leather-noise absolute inset-0" />` and a `<div className="relative">`.
- **UI copy in Spanish** for new user-facing strings, matching the most recent components (`CloudSyncSettings`). Code, comments and commit messages in English.
- **Commit after every task.** Never commit on `main`; work stays on `feat/app-version-and-hp-edit`.
- Run `npm test` (not `npx vitest`) — the script is `vitest run`.

---

### Task 1: Editable max HP

Smallest, fully independent deliverable. The store action already exists and is correct; this adds its first test and its first call site.

**Files:**
- Modify: `src/components/panels/HpPanel.tsx`
- Test: `src/store/character.test.ts`

**Interfaces:**
- Consumes: `useCharacter((s) => s.setMaxHp)` — `(max: number) => void`, defined at `src/store/character.ts:140`. Already clamps to a minimum of 1 and clamps `hp.current` down to the new max.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the failing test**

Append to `src/store/character.test.ts`. Match the file's existing style for resetting the store between tests (read the top of the file and follow whatever it already does — do not invent a new harness).

```ts
describe("setMaxHp", () => {
  it("raises the max and leaves current HP alone", () => {
    useCharacter.getState().setMaxHp(50);
    const hp = useCharacter.getState().character.hp;
    expect(hp.max).toBe(50);
  });

  it("clamps current HP down when the new max is lower", () => {
    useCharacter.getState().setMaxHp(100);
    useCharacter.getState().heal(100);
    useCharacter.getState().setMaxHp(10);
    const hp = useCharacter.getState().character.hp;
    expect(hp.max).toBe(10);
    expect(hp.current).toBe(10);
  });

  it("never goes below 1", () => {
    useCharacter.getState().setMaxHp(0);
    expect(useCharacter.getState().character.hp.max).toBe(1);
    useCharacter.getState().setMaxHp(-5);
    expect(useCharacter.getState().character.hp.max).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test`
Expected: the three new tests PASS immediately — the action already works. This is a characterization test locking in behaviour the UI is about to depend on. If any of them FAIL, stop: the spec's assumption is wrong and the store needs fixing first.

- [ ] **Step 3: Make the max editable in the HP panel**

In `src/components/panels/HpPanel.tsx`, add `setMaxHp` to the store selectors at the top:

```tsx
const setMaxHp = useCharacter((s) => s.setMaxHp);
```

Add edit state next to the existing `useState` calls:

```tsx
const [editingMax, setEditingMax] = useState(false);
const [maxDraft, setMaxDraft] = useState("");
```

Add the commit/cancel helpers:

```tsx
const openMaxEdit = () => {
  setMaxDraft(String(c.hp.max));
  setEditingMax(true);
};

const commitMax = () => {
  const n = parseInt(maxDraft, 10);
  if (!Number.isNaN(n)) setMaxHp(n);
  setEditingMax(false);
};
```

Replace the static max line (currently `<div className="label-caps text-on-surface-variant mt-1">OF {c.hp.max} HP</div>`) with:

```tsx
{editingMax ? (
  <input
    autoFocus
    type="number"
    inputMode="numeric"
    aria-label="HP máximo"
    value={maxDraft}
    onChange={(e) => setMaxDraft(e.target.value)}
    onBlur={commitMax}
    onKeyDown={(e) => {
      if (e.key === "Enter") commitMax();
      if (e.key === "Escape") setEditingMax(false);
    }}
    className="input-inset w-20 text-center font-mono text-sm mt-1"
  />
) : (
  <button
    onClick={openMaxEdit}
    aria-label={`HP máximo ${c.hp.max}. Tocar para editar`}
    className="label-caps text-on-surface-variant mt-1 hover:text-primary transition underline decoration-dotted underline-offset-4"
  >
    OF {c.hp.max} HP
  </button>
)}
```

Note `autoFocus` handles the focus-on-open requirement from the spec.

- [ ] **Step 4: Verify the suite and types still pass**

Run: `npm test`
Expected: PASS (118 tests).

Run: `npm run build`
Expected: succeeds (this also type-checks via `tsc -b`).

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/HpPanel.tsx src/store/character.test.ts
git commit -m "feat: edit max HP inline from the HP panel"
```

---

### Task 2: Build-time version constants and formatter

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/vite-env.d.ts`
- Create: `src/lib/appVersion.ts`
- Test: `src/lib/appVersion.test.ts`

**Interfaces:**
- Produces, for Task 4:
  - `APP_COMMIT: string`
  - `APP_BUILD_TIME: string` (ISO 8601)
  - `formatVersion(commit: string, buildTime: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/appVersion.test.ts`. The input is built from a local `Date` on purpose, so the expectation holds in any timezone.

```ts
import { describe, it, expect } from "vitest";
import { formatVersion } from "./appVersion";

describe("formatVersion", () => {
  it("renders commit, date and time", () => {
    const d = new Date(2026, 7, 1, 15, 4); // 1 Aug 2026, 15:04 local
    expect(formatVersion("f4b3544", d.toISOString())).toBe(
      "f4b3544 · 1 ago 2026, 15:04",
    );
  });

  it("pads single-digit hours and minutes", () => {
    const d = new Date(2026, 0, 9, 4, 7); // 9 Jan 2026, 04:07 local
    expect(formatVersion("abc1234", d.toISOString())).toBe(
      "abc1234 · 9 ene 2026, 04:07",
    );
  });

  it("falls back to the commit alone when the timestamp is unusable", () => {
    expect(formatVersion("dev", "not-a-date")).toBe("dev");
    expect(formatVersion("dev", "")).toBe("dev");
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./appVersion`.

- [ ] **Step 3: Write the module**

Create `src/lib/appVersion.ts`:

```ts
/**
 * Build identity, injected by `define` in vite.config.ts. Lets a device report
 * exactly which build it is running — the PWA can otherwise sit on a stale
 * precache with no visible signal.
 */

const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

// The `typeof` guards keep this importable outside a Vite build (plain Vitest
// runs, any future SSR), where the constants are not substituted.
export const APP_COMMIT: string =
  typeof __APP_COMMIT__ !== "undefined" ? __APP_COMMIT__ : "dev";

export const APP_BUILD_TIME: string =
  typeof __APP_BUILD_TIME__ !== "undefined" ? __APP_BUILD_TIME__ : "";

/** e.g. `f4b3544 · 1 ago 2026, 15:04`. Commit alone if the stamp is unusable. */
export function formatVersion(commit: string, buildTime: string): string {
  const d = new Date(buildTime);
  if (!buildTime || Number.isNaN(d.getTime())) return commit;
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
  return `${commit} · ${day}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
```

- [ ] **Step 4: Declare the globals**

Append to `src/vite-env.d.ts`:

```ts
/** Short git SHA of the build, injected by vite.config.ts. `"dev"` if unknown. */
declare const __APP_COMMIT__: string;
/** ISO timestamp of the build, injected by vite.config.ts. */
declare const __APP_BUILD_TIME__: string;
```

- [ ] **Step 5: Inject the values at build time**

In `vite.config.ts`, add the import at the top:

```ts
import { execSync } from "node:child_process";
```

Add the helper above `export default defineConfig`:

```ts
/**
 * Short commit for the running build. Vercel exposes the full SHA as an env
 * var; locally we ask git. Wrapped in try/catch so a build from a tarball with
 * no `.git` still succeeds.
 */
function appCommit(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}
```

Replace the existing conditional `define` block with one that always injects the
version and keeps the dev-only Gemini key exactly as it was:

```ts
  define: {
    __APP_COMMIT__: JSON.stringify(appCommit()),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    // Dev only: expose the OS GEMINI_KEY to the client so the direct fallback
    // works under `npm run dev`. Production builds inject NOTHING — the key
    // stays server-side in /api/narrate and is never baked into the bundle.
    ...(command === "serve"
      ? {
          "import.meta.env.VITE_GEMINI_KEY": JSON.stringify(
            process.env.GEMINI_KEY ?? "",
          ),
        }
      : {}),
  },
```

Delete the old comment block above `define` that described the Gemini-only behaviour, since that explanation now lives inline.

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: PASS (121 tests).

- [ ] **Step 7: Verify the value actually lands in the bundle**

Run: `npm run build`
Then confirm the real commit was substituted (not the literal identifier):

Run: `git rev-parse --short HEAD`
Run: `grep -o "$(git rev-parse --short HEAD)" dist/assets/*.js | head -1`
Expected: prints the short SHA. If it prints nothing, `define` is not wired up — fix before moving on.

- [ ] **Step 8: Commit**

```bash
git add vite.config.ts src/vite-env.d.ts src/lib/appVersion.ts src/lib/appVersion.test.ts
git commit -m "feat: inject build commit and timestamp at build time"
```

---

### Task 3: Service worker update prompt

Turns the silent auto-update into an explicit, observable one, and adds the periodic check that a background PWA needs.

**Files:**
- Modify: `vite.config.ts` (the `VitePWA({...})` options only)
- Modify: `src/vite-env.d.ts`
- Create: `src/lib/swUpdate.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces, for Task 4: `useSwUpdate` — a Zustand store with `{ needRefresh: boolean; updateNow: () => void }`.

- [ ] **Step 1: Switch the plugin to prompt mode**

In `vite.config.ts`, inside `VitePWA({ ... })`, change:

```ts
      registerType: "autoUpdate",
```

to:

```ts
      // "prompt" (not "autoUpdate"): a silent reload mid-session is worse than
      // an explicit button. `injectRegister: null` because src/lib/swUpdate.ts
      // registers by hand — leaving it on would register the SW twice.
      registerType: "prompt",
      injectRegister: null,
```

Leave `manifest`, `includeAssets` and `workbox` untouched.

- [ ] **Step 2: Add the client types**

Add to the top of `src/vite-env.d.ts`, directly under the existing `vite/client` reference:

```ts
/// <reference types="vite-plugin-pwa/client" />
```

- [ ] **Step 3: Write the update store**

Create `src/lib/swUpdate.ts`:

```ts
import { create } from "zustand";
import { registerSW } from "virtual:pwa-register";

/**
 * Service-worker update state. The browser only looks for a new SW on page
 * load, so an installed PWA that never fully closes can serve a stale precache
 * indefinitely. We register by hand to attach a periodic check (plus focus /
 * online), and surface `needRefresh` so the UI can offer an explicit reload.
 *
 * NOT persisted — live runtime status only.
 */

const CHECK_EVERY_MS = 60 * 60 * 1000; // hourly
const MIN_GAP_MS = 5 * 60 * 1000; // throttle focus/online bursts

interface SwUpdateState {
  needRefresh: boolean;
  /** Activate the waiting SW and reload the page. */
  updateNow: () => void;
}

export const useSwUpdate = create<SwUpdateState>()((set) => {
  let updateSW: ((reload?: boolean) => Promise<void>) | undefined;

  if (typeof window !== "undefined") {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        set({ needRefresh: true });
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        let last = 0;
        const check = () => {
          const now = Date.now();
          if (now - last < MIN_GAP_MS) return;
          last = now;
          void registration.update();
        };
        setInterval(check, CHECK_EVERY_MS);
        window.addEventListener("focus", check);
        window.addEventListener("online", check);
      },
    });
  }

  return {
    needRefresh: false,
    updateNow: () => {
      void updateSW?.(true);
    },
  };
});
```

- [ ] **Step 4: Activate it on boot**

In `src/main.tsx`, add alongside the other imports:

```ts
import "./lib/swUpdate";
```

The import itself performs the registration (the store's initializer runs on first
module evaluation). Place it after the `./index.css` import.

- [ ] **Step 5: Verify build and types**

Run: `npm test`
Expected: PASS (121 tests, unchanged — this task adds no tests; the SW cannot be exercised without a browser).

Run: `npm run build`
Expected: succeeds, and the output still lists `dist/sw.js` and a `workbox-*.js` in the PWA summary.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts src/vite-env.d.ts src/lib/swUpdate.ts src/main.tsx
git commit -m "feat: prompt-based service worker with periodic update checks"
```

---

### Task 4: Version UI — Settings panel and update bar

**Files:**
- Create: `src/components/settings/AboutPanel.tsx`
- Create: `src/components/UpdateBar.tsx`
- Modify: `src/views/Settings.tsx`
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `APP_COMMIT`, `APP_BUILD_TIME`, `formatVersion` from Task 2; `useSwUpdate` from Task 3.

- [ ] **Step 1: Write the About panel**

Create `src/components/settings/AboutPanel.tsx`:

```tsx
import Icon from "@/components/ui/Icon";
import { APP_COMMIT, APP_BUILD_TIME, formatVersion } from "@/lib/appVersion";
import { useSwUpdate } from "@/lib/swUpdate";

/**
 * Which build is this? Without it, "the feature is missing" and "this device
 * is on a stale cached build" are indistinguishable.
 */
export default function AboutPanel() {
  const needRefresh = useSwUpdate((s) => s.needRefresh);
  const updateNow = useSwUpdate((s) => s.updateNow);

  return (
    <section className="bg-surface-container border border-outline-variant/30 rounded-xl p-md relative overflow-hidden">
      <div className="leather-noise absolute inset-0" />
      <div className="relative space-y-sm">
        <h3 className="font-serif text-title-sm text-primary">Acerca de</h3>
        <p className="text-sm text-on-surface-variant">
          Arcanist&rsquo;s Ledger
        </p>
        <p className="font-mono text-xs text-on-surface">
          {formatVersion(APP_COMMIT, APP_BUILD_TIME)}
        </p>

        {needRefresh ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-primary">
              <Icon name="system_update" size={14} filled />
              Actualización disponible
            </span>
            <button className="btn-brass !py-1" onClick={updateNow}>
              <Icon name="refresh" /> Actualizar
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-secondary">
            <Icon name="check_circle" size={14} filled />
            Actualizada
          </span>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Mount it in Settings**

In `src/views/Settings.tsx`, add the import:

```tsx
import AboutPanel from "@/components/settings/AboutPanel";
```

Render it as the **last** section, immediately before the closing `</div>` of the
page wrapper (after the Export `<section>`):

```tsx
      <AboutPanel />
```

- [ ] **Step 3: Write the update bar**

Create `src/components/UpdateBar.tsx`:

```tsx
import Icon from "@/components/ui/Icon";
import { useSwUpdate } from "@/lib/swUpdate";

/**
 * Shown only when a newer build is waiting. Sits above the mobile bottom nav
 * (h-16) so it never covers navigation.
 */
export default function UpdateBar() {
  const needRefresh = useSwUpdate((s) => s.needRefresh);
  const updateNow = useSwUpdate((s) => s.updateNow);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed left-0 right-0 bottom-16 md:bottom-4 z-50 flex justify-center px-md"
    >
      <div className="flex items-center gap-3 bg-surface-container border border-primary/40 rounded-xl px-md py-2 shadow-2xl">
        <Icon name="system_update" className="text-primary" filled />
        <span className="text-sm text-on-surface">Hay una versión nueva</span>
        <button className="btn-brass !py-1" onClick={updateNow}>
          Actualizar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mount the bar in the shell**

In `src/components/AppShell.tsx`, add the import next to the other component
imports:

```tsx
import UpdateBar from "@/components/UpdateBar";
```

Render it beside the existing overlays, right after `<RestMenu ... />`:

```tsx
      <UpdateBar />
```

- [ ] **Step 5: Verify**

Run: `npm test`
Expected: PASS (121 tests).

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/AboutPanel.tsx src/components/UpdateBar.tsx src/views/Settings.tsx src/components/AppShell.tsx
git commit -m "feat: show build version in Settings and prompt when a new build lands"
```

---

### Task 5: Deploy a preview and verify on the device

- [ ] **Step 1: Push the branch**

Ask the user before pushing — pushing without asking is against the project rules.

```bash
git push -u origin feat/app-version-and-hp-edit
```

- [ ] **Step 2: Find the preview URL**

Run: `vercel ls --yes`
Take the newest Preview deployment.

- [ ] **Step 3: Check the version endpoint-free**

Previews sit behind Vercel SSO, so a plain `curl` gets a 302. Use:

Run: `vercel curl "/" --deployment <preview-url> -- -s -o /dev/null -w "%{http_code}\n"`
Expected: `200`.

- [ ] **Step 4: Hand off for device testing**

Give the user the preview URL and these checks:
1. Settings → "Acerca de" shows a commit + date matching the deployed commit.
2. Tapping `OF NN HP` opens an input; changing it sticks after a reload.
3. The new max HP shows up on another device after a sync.

State plainly: the already-installed PWA on the tablet needs one manual reload
(or a full close-and-reopen) before any of this appears, because the old
auto-updating service worker has to replace itself first.

---

## Self-review notes

- **Spec coverage:** version identity → Task 2; update detection + periodic check → Task 3; Settings "Acerca de" and update bar → Task 4; editable max HP + free sync → Task 1; acceptance criteria 1–4 → Task 5; criterion 5 (`npm test` / `npm run build` green) → verification steps in every task.
- **Test count:** 115 today → 118 after Task 1 → 121 after Task 2. Tasks 3 and 4 add none by design (no DOM test environment, per the global constraint).
- **The one behavioural risk**, already accepted in the spec: switching `registerType` only takes effect after the currently-installed service worker updates itself once.
