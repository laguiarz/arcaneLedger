import type { CombatRecord } from "@/types/combatLog";
import type { SyncedState } from "./syncMerge";
import { getSecret } from "./syncConfig";

/**
 * Thin client for the /api/sync serverless endpoint. Every call carries the
 * shared secret as a Bearer token. Throws on any non-2xx so the orchestration
 * layer can flip to an error/offline state.
 */

export interface RemoteBundle {
  state: SyncedState | null;
  combats: CombatRecord[];
}

function base(characterId: string): string {
  return `/api/sync/${encodeURIComponent(characterId)}`;
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getSecret()}`,
  };
}

async function ensureOk(res: Response): Promise<void> {
  if (res.ok) return;
  let detail = `${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) detail = body.error;
  } catch {
    /* keep status-line detail */
  }
  throw new Error(`Sync failed: ${detail}`);
}

/** GET the full per-character bundle (state blob + combat records). */
export async function getRemote(
  characterId: string,
  signal?: AbortSignal,
): Promise<RemoteBundle> {
  const res = await fetch(base(characterId), {
    method: "GET",
    headers: authHeaders(),
    signal,
  });
  await ensureOk(res);
  const data = (await res.json()) as Partial<RemoteBundle>;
  return { state: data.state ?? null, combats: data.combats ?? [] };
}

/** PUT the durable state blob (server enforces last-write-wins). */
export async function putState(
  characterId: string,
  state: SyncedState,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(base(characterId), {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ state }),
    signal,
  });
  await ensureOk(res);
}

/** PUT a single combat record (server appends idempotently by id). */
export async function postCombat(
  characterId: string,
  record: CombatRecord,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(base(characterId), {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ combat: record }),
    signal,
  });
  await ensureOk(res);
}
