/**
 * Cloud-sync configuration, kept in localStorage (device-local). Single-user
 * app: the shared secret is the only auth. Storing it client-side is adequate
 * for non-sensitive D&D data — anyone who wants to write your blob would need
 * the secret you typed on your own devices.
 */

const KEY_SECRET = "al.sync.secret";
const KEY_ENABLED = "al.sync.enabled";
const KEY_LAST = "al.sync.lastSynced";
const KEY_BASELINE = "al.sync.baseline";
const KEY_APPLIED = "al.sync.appliedUpdatedAt";

function read(key: string): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — ignore */
  }
}

export function getSecret(): string {
  return read(KEY_SECRET)?.trim() ?? "";
}

export function setSecret(value: string): void {
  write(KEY_SECRET, value.trim());
}

export function isSyncEnabled(): boolean {
  return read(KEY_ENABLED) === "1" && getSecret().length > 0;
}

export function setSyncEnabled(enabled: boolean): void {
  write(KEY_ENABLED, enabled ? "1" : "0");
}

export function getLastSynced(): number | null {
  const raw = read(KEY_LAST);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function setLastSynced(ms: number): void {
  write(KEY_LAST, String(ms));
}

/**
 * Digest of the durable payload as of the last CONFIRMED write or apply.
 * `null` means this device has never confirmed a sync — which the flag logic
 * treats as "has unsaved work", so an upgrading device is offered Save rather
 * than being told it is clean.
 */
export function getBaseline(): string | null {
  return read(KEY_BASELINE);
}

export function setBaseline(digest: string): void {
  write(KEY_BASELINE, digest);
}

/** The server-issued stamp this device last applied or successfully wrote. */
export function getAppliedUpdatedAt(): number | null {
  const raw = read(KEY_APPLIED);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function setAppliedUpdatedAt(ms: number): void {
  write(KEY_APPLIED, String(ms));
}
