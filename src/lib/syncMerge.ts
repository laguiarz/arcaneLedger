import type { CombatRecord } from "@/types/combatLog";

/**
 * The per-character blob synced to the cloud. `sheet` and `coin` are opaque
 * here (typed precisely at the call sites) — this module only cares about the
 * `updatedAt` stamp used for last-write-wins.
 */
export interface SyncedState {
  /** ms epoch, stamped whenever the local durable state changes. */
  updatedAt: number;
  sheet: unknown;
  coin: unknown;
}

/**
 * Last-write-wins by `updatedAt`. On a tie, local wins so a just-made local
 * edit is never clobbered by an equally-stamped remote. Nulls are tolerated.
 */
export function mergeState(
  local: SyncedState | null,
  remote: SyncedState | null,
): SyncedState | null {
  if (!local) return remote;
  if (!remote) return local;
  return remote.updatedAt > local.updatedAt ? remote : local;
}

/**
 * Union two combat-record lists by `id` (first-seen wins — local is passed
 * first), sorted by `endedAt` descending. Records are immutable, so a union is
 * always safe: neither device can ever have a *different* record under the same
 * id.
 */
export function mergeCombats(
  local: CombatRecord[],
  remote: CombatRecord[],
): CombatRecord[] {
  const byId = new Map<string, CombatRecord>();
  for (const r of [...local, ...remote]) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  return [...byId.values()].sort((a, b) => b.endedAt - a.endedAt);
}
