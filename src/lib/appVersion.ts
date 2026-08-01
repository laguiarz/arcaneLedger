/**
 * Build identity, injected by `define` in vite.config.ts. Lets a device report
 * exactly which build it is running — the PWA can otherwise sit on a stale
 * precache with no visible signal, making "not implemented yet" and "stale
 * cached build" indistinguishable.
 */

const MONTHS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
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
