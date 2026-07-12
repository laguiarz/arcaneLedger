# Light / Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted 2-state Dark/Light theme toggle in Settings, with a bespoke parchment light theme driven by CSS-variable color tokens.

**Architecture:** Convert every Tailwind color token from a fixed hex into `rgb(var(--token) / <alpha-value>)`; declare the RGB channels as CSS variables in `index.css` under `:root` (dark, default) and `.light` (parchment). A Zustand store persists the choice and toggles the `dark`/`light` class on `<html>`. An inline `<head>` script applies the class before first paint (anti-FOUC). Components are untouched.

**Tech Stack:** React, Vite, TypeScript, TailwindCSS, Zustand (+persist), Vitest.

## Global Constraints

- Dark theme must remain **visually identical** to today (it is the default and the current values).
- Default theme is `'dark'`. Persist key: `arcanist-ledger:theme` (matches existing `arcanist-ledger:*` convention).
- Preserve Tailwind opacity modifiers (`border-primary/40`, `bg-primary/10`) — colors MUST use the `rgb(var(--x) / <alpha-value>)` form, channels as space-separated RGB (no `rgb()` wrapper, no commas).
- Bash rule: one command per call, never chain with `&&`/`;`.
- Dev server runs on port **5180**.
- Light palette primary text/background pairs must meet WCAG AA.

---

### Task 1: Theme store with pure helpers

**Files:**
- Create: `src/store/theme.ts`
- Test: `src/store/theme.test.ts`

**Interfaces:**
- Produces:
  - `type Theme = 'dark' | 'light'`
  - `nextTheme(t: Theme): Theme` — pure toggle
  - `normalizeTheme(v: unknown): Theme` — validates persisted value, defaults `'dark'`
  - `applyThemeClass(t: Theme): void` — sets `dark`/`light` class on `document.documentElement`, updates `<meta name="theme-color">`, sets `color-scheme`
  - `useTheme` Zustand store: `{ theme: Theme, setTheme(t), toggle() }`, persisted under `arcanist-ledger:theme`

- [ ] **Step 1: Write the failing test**

```ts
// src/store/theme.test.ts
import { describe, it, expect } from "vitest";
import { nextTheme, normalizeTheme } from "@/store/theme";

describe("nextTheme", () => {
  it("toggles dark to light", () => {
    expect(nextTheme("dark")).toBe("light");
  });
  it("toggles light to dark", () => {
    expect(nextTheme("light")).toBe("dark");
  });
});

describe("normalizeTheme", () => {
  it("defaults unknown values to dark", () => {
    expect(normalizeTheme("purple")).toBe("dark");
    expect(normalizeTheme(undefined)).toBe("dark");
    expect(normalizeTheme(null)).toBe("dark");
  });
  it("passes through valid themes", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("dark")).toBe("dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/theme.test.ts`
Expected: FAIL — cannot resolve `@/store/theme`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/store/theme.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light";

const THEME_COLOR: Record<Theme, string> = {
  dark: "#110e09",
  light: "#f4ead6",
};

export function nextTheme(t: Theme): Theme {
  return t === "dark" ? "light" : "dark";
}

export function normalizeTheme(v: unknown): Theme {
  return v === "light" ? "light" : "dark";
}

/** Apply the theme to the document: html class, color-scheme, theme-color meta. */
export function applyThemeClass(t: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(t);
  root.style.colorScheme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[t]);
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (t) => {
        applyThemeClass(t);
        set({ theme: t });
      },
      toggle: () => {
        const t = nextTheme(get().theme);
        applyThemeClass(t);
        set({ theme: t });
      },
    }),
    {
      name: "arcanist-ledger:theme",
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) {
          const t = normalizeTheme(state.theme);
          state.theme = t;
          applyThemeClass(t);
        }
      },
    },
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/theme.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/theme.ts src/store/theme.test.ts
git commit -m "feat: theme store with dark/light toggle + persistence"
```

---

### Task 2: Token → CSS variable conversion + anti-FOUC

**Files:**
- Modify: `tailwind.config.js` (colors block)
- Modify: `src/index.css` (add `:root` + `.light` variable blocks)
- Modify: `index.html` (anti-FOUC inline script; drop hardcoded `class="dark"`)

**Interfaces:**
- Consumes: nothing (foundational).
- Produces: all existing `bg-surface` / `text-on-surface` / `border-primary/40` etc. now resolve through CSS variables; `.light` on `<html>` yields parchment.

- [ ] **Step 1: Rewrite the `colors` block in `tailwind.config.js`**

Replace each hex with `rgb(var(--token) / <alpha-value>)`:

```js
colors: {
  surface: "rgb(var(--surface) / <alpha-value>)",
  "surface-dim": "rgb(var(--surface-dim) / <alpha-value>)",
  "surface-bright": "rgb(var(--surface-bright) / <alpha-value>)",
  "surface-container-lowest": "rgb(var(--surface-container-lowest) / <alpha-value>)",
  "surface-container-low": "rgb(var(--surface-container-low) / <alpha-value>)",
  "surface-container": "rgb(var(--surface-container) / <alpha-value>)",
  "surface-container-high": "rgb(var(--surface-container-high) / <alpha-value>)",
  "surface-container-highest": "rgb(var(--surface-container-highest) / <alpha-value>)",
  "surface-variant": "rgb(var(--surface-variant) / <alpha-value>)",
  "on-surface": "rgb(var(--on-surface) / <alpha-value>)",
  "on-surface-variant": "rgb(var(--on-surface-variant) / <alpha-value>)",
  outline: "rgb(var(--outline) / <alpha-value>)",
  "outline-variant": "rgb(var(--outline-variant) / <alpha-value>)",
  primary: "rgb(var(--primary) / <alpha-value>)",
  "on-primary": "rgb(var(--on-primary) / <alpha-value>)",
  "primary-container": "rgb(var(--primary-container) / <alpha-value>)",
  "on-primary-container": "rgb(var(--on-primary-container) / <alpha-value>)",
  "primary-fixed": "rgb(var(--primary-fixed) / <alpha-value>)",
  "primary-fixed-dim": "rgb(var(--primary-fixed-dim) / <alpha-value>)",
  "on-primary-fixed": "rgb(var(--on-primary-fixed) / <alpha-value>)",
  "on-primary-fixed-variant": "rgb(var(--on-primary-fixed-variant) / <alpha-value>)",
  "inverse-primary": "rgb(var(--inverse-primary) / <alpha-value>)",
  secondary: "rgb(var(--secondary) / <alpha-value>)",
  "on-secondary": "rgb(var(--on-secondary) / <alpha-value>)",
  "secondary-container": "rgb(var(--secondary-container) / <alpha-value>)",
  "on-secondary-container": "rgb(var(--on-secondary-container) / <alpha-value>)",
  tertiary: "rgb(var(--tertiary) / <alpha-value>)",
  "on-tertiary": "rgb(var(--on-tertiary) / <alpha-value>)",
  "tertiary-container": "rgb(var(--tertiary-container) / <alpha-value>)",
  "on-tertiary-container": "rgb(var(--on-tertiary-container) / <alpha-value>)",
  error: "rgb(var(--error) / <alpha-value>)",
  "on-error": "rgb(var(--on-error) / <alpha-value>)",
  "error-container": "rgb(var(--error-container) / <alpha-value>)",
  "on-error-container": "rgb(var(--on-error-container) / <alpha-value>)",
  background: "rgb(var(--background) / <alpha-value>)",
  "on-background": "rgb(var(--on-background) / <alpha-value>)",
},
```

- [ ] **Step 2: Add the variable blocks to `src/index.css`**

Inside `@layer base`, before the `html, body, #root` rule, add `:root` (dark — the current hex values converted to RGB channels) and `.light` (parchment). Channels are space-separated RGB, no commas.

```css
:root {
  color-scheme: dark;
  /* Dark — Mystic Steampunk (current values) */
  --surface: 22 19 14;
  --surface-dim: 22 19 14;
  --surface-bright: 61 57 51;
  --surface-container-lowest: 17 14 9;
  --surface-container-low: 30 27 22;
  --surface-container: 35 31 26;
  --surface-container-high: 45 41 36;
  --surface-container-highest: 56 52 46;
  --surface-variant: 56 52 46;
  --on-surface: 233 225 216;
  --on-surface-variant: 209 197 180;
  --outline: 154 143 128;
  --outline-variant: 78 70 57;
  --primary: 233 193 118;
  --on-primary: 65 45 0;
  --primary-container: 197 160 89;
  --on-primary-container: 78 55 0;
  --primary-fixed: 255 222 165;
  --primary-fixed-dim: 233 193 118;
  --on-primary-fixed: 38 25 0;
  --on-primary-fixed-variant: 93 66 1;
  --inverse-primary: 119 90 25;
  --secondary: 186 198 236;
  --on-secondary: 35 48 78;
  --secondary-container: 58 70 102;
  --on-secondary-container: 168 180 218;
  --tertiary: 176 198 249;
  --on-tertiary: 23 48 89;
  --tertiary-container: 143 165 214;
  --on-tertiary-container: 35 58 101;
  --error: 255 180 171;
  --on-error: 105 0 5;
  --error-container: 147 0 10;
  --on-error-container: 255 218 214;
  --background: 22 19 14;
  --on-background: 233 225 216;

  /* Non-token surfaces (dark) */
  --app-bg: radial-gradient(1200px 600px at 80% -10%, rgba(46, 58, 89, 0.25), transparent 60%),
            radial-gradient(900px 500px at -10% 110%, rgba(119, 90, 25, 0.18), transparent 60%),
            linear-gradient(180deg, #110e09 0%, #16130e 60%, #121625 100%);
  --glass-bg: rgba(35, 31, 26, 0.72);
  --leather-noise-opacity: 0.03;
  --brass-from: #c5a059;
  --brass-to: #4e3700;
  --etched-tint: rgba(197, 160, 89, 0.06);
  --scrollbar-thumb: #38342e;
  --scrollbar-thumb-hover: #4e4639;
}

.light {
  color-scheme: light;
  /* Parchment — first-pass values, WCAG-checked in Task 6 */
  --surface: 244 234 214;
  --surface-dim: 231 217 189;
  --surface-bright: 251 245 230;
  --surface-container-lowest: 251 245 230;
  --surface-container-low: 240 228 203;
  --surface-container: 234 221 194;
  --surface-container-high: 226 211 180;
  --surface-container-highest: 217 200 165;
  --surface-variant: 217 200 165;
  --on-surface: 46 36 22;
  --on-surface-variant: 92 77 56;
  --outline: 138 118 88;
  --outline-variant: 200 181 143;
  --primary: 122 90 18;
  --on-primary: 255 246 224;
  --primary-container: 227 199 128;
  --on-primary-container: 78 55 0;
  --primary-fixed: 227 199 128;
  --primary-fixed-dim: 200 168 90;
  --on-primary-fixed: 38 25 0;
  --on-primary-fixed-variant: 93 66 1;
  --inverse-primary: 233 193 118;
  --secondary: 58 70 102;
  --on-secondary: 238 242 251;
  --secondary-container: 190 202 232;
  --on-secondary-container: 35 48 78;
  --tertiary: 47 75 122;
  --on-tertiary: 238 242 251;
  --tertiary-container: 180 200 240;
  --on-tertiary-container: 23 48 89;
  --error: 140 29 24;
  --on-error: 255 240 238;
  --error-container: 255 218 214;
  --on-error-container: 105 0 5;
  --background: 244 234 214;
  --on-background: 46 36 22;

  /* Non-token surfaces (parchment) */
  --app-bg: radial-gradient(1200px 600px at 80% -10%, rgba(197, 160, 89, 0.18), transparent 60%),
            radial-gradient(900px 500px at -10% 110%, rgba(150, 120, 60, 0.12), transparent 60%),
            linear-gradient(180deg, #f6ecd8 0%, #f2e7cf 60%, #ede0c4 100%);
  --glass-bg: rgba(244, 234, 214, 0.72);
  --leather-noise-opacity: 0.04;
  --brass-from: #9a7a2c;
  --brass-to: #6b4e12;
  --etched-tint: rgba(122, 90, 18, 0.08);
  --scrollbar-thumb: #cdb98f;
  --scrollbar-thumb-hover: #b79f6f;
}
```

- [ ] **Step 3: Point `body` background and `color-scheme` at the variables**

In `src/index.css`, change the `:root { color-scheme: dark; }` rule (now folded into the block above) and update `body`:

```css
  body {
    font-family: "Manrope", ui-sans-serif, system-ui, sans-serif;
    background: var(--app-bg);
    background-attachment: fixed;
    color: rgb(var(--on-surface));
  }
```

Update the scrollbar rules to use the variables:

```css
  ::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 8px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
  ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); background-clip: padding-box; border: 2px solid transparent; }
```

- [ ] **Step 4: Add anti-FOUC script + de-hardcode the class in `index.html`**

Change `<html lang="en" class="dark">` to `<html lang="en">`, and add this script as the FIRST child of `<head>`:

```html
    <script>
      (function () {
        try {
          var raw = localStorage.getItem("arcanist-ledger:theme");
          var t = "dark";
          if (raw) {
            var parsed = JSON.parse(raw);
            var v = parsed && parsed.state ? parsed.state.theme : null;
            if (v === "light") t = "light";
          }
          document.documentElement.classList.add(t);
          document.documentElement.style.colorScheme = t;
        } catch (e) {
          document.documentElement.classList.add("dark");
        }
      })();
    </script>
```

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.js src/index.css index.html
git commit -m "feat: drive color tokens through CSS variables + parchment light theme"
```

---

### Task 3: Theme-aware utility classes

**Files:**
- Modify: `src/index.css` (`@layer components`: `.glass-card`, `.leather-noise`, `.brass-border`, `.etched-top`)

**Interfaces:**
- Consumes: the `--glass-bg`, `--leather-noise-opacity`, `--brass-from`, `--brass-to`, `--etched-tint` variables from Task 2.

- [ ] **Step 1: Update the utilities to read variables**

```css
  .glass-card {
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .brass-border {
    border: 1px solid;
    border-image: linear-gradient(180deg, var(--brass-from), var(--brass-to)) 1;
  }

  .etched-top {
    border-top: 2px solid var(--brass-from);
    background-image: linear-gradient(180deg, var(--etched-tint) 0%, transparent 100%);
  }

  .leather-noise {
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    opacity: var(--leather-noise-opacity);
    pointer-events: none;
  }
```

- [ ] **Step 2: Build to confirm CSS compiles**

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: make glass/leather/brass utilities theme-aware"
```

---

### Task 4: Appearance switch in Settings

**Files:**
- Modify: `src/views/Settings.tsx`

**Interfaces:**
- Consumes: `useTheme` (`theme`, `setTheme`) from Task 1; `Icon`, `SectionHeader` already imported.

- [ ] **Step 1: Import the theme store**

Add near the other imports in `src/views/Settings.tsx`:

```tsx
import { useTheme, type Theme } from "@/store/theme";
```

- [ ] **Step 2: Read theme state in the component**

Inside `Settings()`, after the existing store selectors:

```tsx
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
```

- [ ] **Step 3: Add the Appearance section**

Insert as the first `<section>` (above Library), so it is easy to find:

```tsx
      <section className="bg-surface-container border border-outline-variant/30 rounded-xl p-md relative overflow-hidden">
        <div className="leather-noise absolute inset-0" />
        <div className="relative">
          <h3 className="font-serif text-title-sm text-primary mb-sm">Appearance</h3>
          <p className="text-sm text-on-surface-variant mb-sm">
            Switch between the dark "midnight tome" and light "parchment" themes.
          </p>
          <div className="inline-flex rounded-md border border-outline-variant/60 overflow-hidden" role="group" aria-label="Theme">
            {(["dark", "light"] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                aria-pressed={theme === t}
                className={
                  "inline-flex items-center gap-2 px-sm py-2 text-xs font-bold uppercase tracking-wider transition " +
                  (theme === t
                    ? "bg-primary-container text-on-primary-container"
                    : "bg-transparent text-on-surface-variant hover:text-primary")
                }
              >
                <Icon name={t === "dark" ? "dark_mode" : "light_mode"} />
                {t === "dark" ? "Dark" : "Light"}
              </button>
            ))}
          </div>
        </div>
      </section>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/views/Settings.tsx
git commit -m "feat: add Appearance theme switch to Settings"
```

---

### Task 5: Raw-color audit for light theme

**Files:**
- Modify: whichever of the 21 files (see spec) have raw colors that read wrong on parchment. Most likely: `border-amber-900/30` occurrences (Settings, Coin, others) and any `text-*-400`/hardcoded light-on-dark text.

**Interfaces:**
- Consumes: token classes from Task 2.

- [ ] **Step 1: Enumerate raw colors**

Run: `npx tsc --noEmit` (baseline clean) then grep review. Use the Grep tool for `amber-|slate-|zinc-|neutral-|#[0-9a-fA-F]{3,6}|rgba?\(` across `src/**/*.tsx`. For each hit, classify: (a) fine in both themes (glows/shadows, decorative overlays) → leave; (b) reads wrong on parchment (e.g. `border-amber-900/30` is fine but low-key; hardcoded light text on assumed-dark bg) → replace with the nearest semantic token (`border-outline-variant/…`, `text-on-surface`, etc.).

- [ ] **Step 2: Apply minimal replacements**

Replace only category (b). Common one: swap `border-amber-900/30` → `border-outline-variant/40` where it delineates cards, so the border tone tracks the theme. Do NOT touch glow/shadow rgba (they read acceptably in both).

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: make audited raw colors theme-aware for parchment"
```

---

### Task 6: Validation & manual verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all tests pass (existing 84 + new theme tests).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npx vite build`
Expected: build succeeds.

- [ ] **Step 4: Manual pass (dev server on 5180)**

Run: `npx vite --port 5180` (background). Load the app, open Settings, toggle Light/Dark:
- Verify instant re-theme across Dashboard, Encounter, Combat, Spellbook, Skills, Coin, Settings.
- Reload — confirm the chosen theme sticks and there is no flash of the wrong theme.
- Eyeball parchment contrast on body text, headers, chips, buttons, inputs. Note any low-contrast spots and adjust the corresponding `.light` variable in `index.css`.

- [ ] **Step 5: Final commit if adjustments were made**

```bash
git add -A
git commit -m "polish: parchment palette contrast adjustments"
```

---

## Self-Review

**Spec coverage:**
- Theme engine (tokens→CSS vars) → Task 2 ✓
- Parchment palette → Task 2 (`.light` block) ✓
- Non-token surfaces (body, glass/leather/brass/etched) → Tasks 2 & 3 ✓
- Raw-color audit → Task 5 ✓
- Persisted state + anti-FOUC → Tasks 1 & 2 ✓
- Appearance switch in Settings → Task 4 ✓
- Theme store unit tests + WCAG manual check → Tasks 1 & 6 ✓
- Default Dark, dark unchanged → Global Constraints + Task 2 (identical values) ✓

**Placeholder scan:** none — all steps carry concrete code/commands. Task 5 is inherently a review pass but has explicit classify/replace rules.

**Type consistency:** `Theme`, `nextTheme`, `normalizeTheme`, `applyThemeClass`, `useTheme` used consistently across Tasks 1 and 4. Persist key `arcanist-ledger:theme` identical in Task 1 store and Task 2 anti-FOUC script (both read `state.theme`).
