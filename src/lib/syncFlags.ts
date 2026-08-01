import type { SyncStatus } from "@/store/sync";

/**
 * Pure sync logic, deliberately separated from the store and the header.
 *
 * The header imports the service-worker store, which imports
 * `virtual:pwa-register` and cannot run under Vitest, so anything worth testing
 * lives here instead.
 */

/** Stable stringify: object keys sorted, so key order never changes the digest. */
function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(",")}}`;
}

/**
 * Digest of the durable payload. Content-based ON PURPOSE: "do I have unsaved
 * work?" must not depend on any device clock, and a device that has never
 * recorded a baseline must read as dirty rather than clean — offering "Save"
 * can only add data, offering nothing can lose it.
 */
export function digestState(payload: unknown): string {
  const s = stable(payload);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = (Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13)) >>> 0;
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}-${s.length.toString(36)}`;
}

export function syncFlags(a: {
  /** Digest as of the last confirmed write or apply. `null` = never confirmed. */
  baseline: string | null;
  current: string;
  /** Server stamp this device last applied or successfully wrote. */
  lastAppliedUpdatedAt: number | null;
  /** Server stamp seen by the most recent check. */
  remoteUpdatedAt: number | null;
  enabled: boolean;
}): { dirty: boolean; remoteAhead: boolean } {
  if (!a.enabled) return { dirty: false, remoteAhead: false };
  return {
    dirty: a.baseline === null || a.baseline !== a.current,
    // Equality, not ordering: BOTH stamps come from the server's clock, so no
    // device clock takes part in deciding who is ahead.
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

/**
 * What the header renders. `status` and the flags are orthogonal — `status` is
 * global and combat uploads mutate it too, so it drives only the spinner and
 * the error adornment, never which action is offered.
 */
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
