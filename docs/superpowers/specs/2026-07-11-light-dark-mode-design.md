# Light / Dark Mode — Design

**Date:** 2026-07-11
**Branch:** `feat/light-dark-mode`
**Status:** Approved (design), pending implementation plan

## Problem statement

The app ships with a single hardcoded dark palette ("Mystic Steampunk"). Color
tokens live as fixed hex values in `tailwind.config.js`, `index.html` pins
`<html class="dark">`, and `index.css` hardcodes the body background and themed
utility classes. There is no way for a user to switch to a light theme, which
hurts readability in bright environments.

## Goal

Add a user-controlled **Light / Dark** theme toggle with a bespoke parchment
light theme that fits the D&D-manual aesthetic. Default stays **Dark** (current
look). No visual regression to the existing dark experience.

## User story

As a player using the app at the table under bright light, I want to switch the
app to a light "old manual" theme so the screen is comfortable to read, and I
want my choice remembered across sessions.

## Scope

- Theme engine: convert color tokens to CSS variables so both themes share the
  same semantic token names and Tailwind opacity modifiers keep working.
- Bespoke **parchment** light palette (not a mechanical inversion).
- Theme-aware treatment of the non-token surfaces: `body` background gradients
  and the `.glass-card` / `.leather-noise` / `.brass-border` / `.etched-top`
  utility classes in `index.css`.
- Audit of ~48 raw color usages across 21 component files; make theme-aware only
  those that read wrong on parchment.
- Persisted theme state (localStorage) + anti-FOUC inline script.
- An "Appearance" row with a Dark/Light switch in the **Settings** page.
- Unit tests for the theme store; manual WCAG AA contrast verification for the
  light palette.

## Out of scope

- A "System" (follow-OS) option — deferred; toggle is 2-state (Dark/Light).
- A header/global toggle — the control lives only in Settings for now.
- CSS-variable-driven per-user custom palettes / theme editor.
- Any non-color visual redesign.

## Decisions

### Two states, default Dark
`theme: 'dark' | 'light'`, default `'dark'`. No automatic `prefers-color-scheme`
following (deferred). User choice persisted to localStorage.

### Control location: Settings only
An "Appearance" section in `src/views/Settings.tsx` with a Dark/Light switch
(sun/moon icons, accessible labels + `aria-pressed`). Header stays clean.

### Light aesthetic: bespoke parchment
Warm parchment surfaces, brown ink text, darkened brass accents — reads like an
aged manual page, not a generic white app.

## Architecture

### Token → CSS variable conversion (the engine)

The codebase leans heavily on Tailwind opacity modifiers (`border-primary/40`,
`bg-primary/10`, `bg-secondary/10`, …). To preserve those, each color token in
`tailwind.config.js` becomes:

```js
surface: "rgb(var(--surface) / <alpha-value>)"
```

and the RGB **channels** (space-separated, no `rgb()` wrapper) are declared as
CSS variables in `index.css`:

```css
:root {            /* dark — default */
  --surface: 22 19 14;          /* #16130e */
  --on-surface: 233 225 216;    /* #e9e1d8 */
  /* …all tokens… */
}
.light {           /* parchment override */
  --surface: 244 234 214;       /* #f4ead6 */
  --on-surface: 46 36 22;       /* #2e2416 */
  /* …all tokens… */
}
```

Components are untouched — they keep referencing `bg-surface`, `text-on-surface`,
`border-primary/40`, etc. A plain-hex `var()` approach was rejected because it
breaks Tailwind's `/opacity` modifiers that the codebase uses in many places.

### Parchment palette (first pass — to refine in review)

| Token | Dark (current) | Light (proposed) |
|---|---|---|
| `surface` / `background` | `#16130e` | `#f4ead6` |
| `surface-dim` | `#16130e` | `#e7d9bd` |
| `surface-bright` | `#3d3933` | `#fbf5e6` |
| `surface-container-lowest` | `#110e09` | `#fbf5e6` |
| `surface-container-low` | `#1e1b16` | `#f0e4cb` |
| `surface-container` | `#231f1a` | `#eaddc2` |
| `surface-container-high` | `#2d2924` | `#e2d3b4` |
| `surface-container-highest` | `#38342e` | `#d9c8a5` |
| `surface-variant` | `#38342e` | `#d9c8a5` |
| `on-surface` | `#e9e1d8` | `#2e2416` |
| `on-surface-variant` | `#d1c5b4` | `#5c4d38` |
| `outline` | `#9a8f80` | `#8a7658` |
| `outline-variant` | `#4e4639` | `#c8b58f` |
| `primary` | `#e9c176` | `#7a5a12` |
| `on-primary` | `#412d00` | `#fff6e0` |
| `primary-container` | `#c5a059` | `#e3c780` |
| `on-primary-container` | `#4e3700` | `#4e3700` |
| `secondary` | `#bac6ec` | `#3a4666` |
| `on-secondary` | `#23304e` | `#eef2fb` |
| `tertiary` | `#b0c6f9` | `#2f4b7a` |
| `error` | `#ffb4ab` | `#8c1d18` |
| `on-error` | `#690005` | `#fff0ee` |

Accent tokens (secondary/tertiary indigo, error) are re-toned for AA contrast on
parchment. Values are a starting point; tuned during review/implementation.

### Non-token surfaces (`index.css`)

- `body` background: dark radial+linear gradients moved behind a variable; light
  variant uses warm, low-intensity tints on parchment.
- `.glass-card`: surface tint + blur re-toned per theme.
- `.leather-noise`: opacity/color adjusted so the texture reads on light.
- `.brass-border`, `.etched-top`: brass gradient darkened for parchment.
- `color-scheme` in `:root` switches with theme (form controls / scrollbars).

### Raw-color audit

~48 raw usages across 21 files (`border-amber-900/30`, `rgba(...)` shadows and
glows, etc.). Each is triaged: keep as-is where it reads fine in both themes,
otherwise swap to a token or add a theme-aware value. The list is enumerated
during implementation; nothing is silently left broken.

### State + anti-FOUC

- A small Zustand store `useTheme` (`theme`, `setTheme`, `toggle`) persisted to
  localStorage under a dedicated key. On change it toggles `dark`/`light` on
  `document.documentElement` and updates `<meta name="theme-color">`.
- **Anti-FOUC:** an inline `<head>` script reads the persisted key and sets the
  `<html>` class before first paint. `index.html` no longer hardcodes `dark`.

## Data model impact

None (no character-data schema change; persisted theme is a separate localStorage
key, unrelated to the character persist version).

## Frontend impact

- New `src/store/theme.ts`.
- New "Appearance" section + switch control in `src/views/Settings.tsx`.
- `tailwind.config.js` colors → `rgb(var(--token) / <alpha-value>)`.
- `index.css` — token variable blocks (`:root` / `.light`) + theme-aware
  utilities.
- `index.html` — anti-FOUC inline script; drop hardcoded `class="dark"`.

## Accessibility considerations

- Switch has a visible label, sun/moon icon, and `aria-pressed`.
- Light palette text/background pairs verified to meet **WCAG AA** (≥4.5:1 body,
  ≥3:1 large text).
- `color-scheme` set per theme so native controls/scrollbars follow.

## Performance considerations

Negligible: CSS-variable swap on a class toggle; no re-render of data. Inline
anti-FOUC script is a few lines.

## Observability impact

None required (local UI preference). Optionally no logging.

## Security impact

None. No new network calls, no untrusted input; theme value is a constrained
enum read from localStorage (validated against `'dark' | 'light'`).

## Acceptance criteria

1. A Dark/Light switch appears in Settings; default state is Dark.
2. Toggling instantly re-themes the whole app (all pages) with no component-level
   changes needed.
3. The choice persists across reloads and app restarts.
4. No flash of the wrong theme on load (anti-FOUC verified).
5. The dark theme is visually unchanged from today.
6. The light theme uses the bespoke parchment palette; primary text/background
   pairs meet WCAG AA.
7. `body` background, glass/leather/brass utilities, and any audited raw colors
   read correctly in both themes.
8. Theme store unit tests pass; `tsc` and build are clean.

## Risks

- **Missed raw colors** producing low-contrast spots in light mode → mitigated by
  the enumerated audit + manual pass over every page.
- **Opacity-modifier regressions** if the RGB-channel conversion is done wrong →
  mitigated by the `rgb(var(--x) / <alpha-value>)` pattern and a visual check.
- **Palette tuning** — first-pass hex values may need iteration for a cohesive
  parchment feel.

## Open questions

None blocking. Palette values are explicitly first-pass and refined in review.
