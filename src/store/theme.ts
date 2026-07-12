import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Theme store — a single global UI preference (dark or light), decoupled from
 * the character and its persistence version. Lives in localStorage only.
 * Dark is the default and matches the original hardcoded look; light is the
 * bespoke parchment theme. The actual colors are CSS variables swapped by the
 * `dark` / `light` class on <html> (see index.css).
 */

export type Theme = "dark" | "light";

const THEME_COLOR: Record<Theme, string> = {
  dark: "#110e09",
  light: "#f4ead6",
};

export function nextTheme(t: Theme): Theme {
  return t === "dark" ? "light" : "dark";
}

/** Validate a persisted/unknown value, defaulting to dark. */
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
