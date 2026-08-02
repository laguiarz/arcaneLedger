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
  // characterId travels as a query param (not a path segment) so the function
  // is a plain `api/sync.ts` — dynamic route files don't route reliably under
  // `vercel dev`.
  return `/api/sync?characterId=${encodeURIComponent(characterId)}`;
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

export interface PutResult {
  /**
   * Whether the server actually wrote. `undefined` means a deployment older
   * than compare-and-set, which must be treated as applied — never as failure.
   */
  applied?: boolean;
  /** The stamp now stored server-side: the new one, or the existing one. */
  updatedAt?: number;
}

/**
 * PUT the durable state blob. `baseUpdatedAt` is the stamp this device last
 * applied; the server writes only if it still matches, unless `force`.
 */
export async function putState(
  characterId: string,
  state: SyncedState,
  opts: { baseUpdatedAt: number | null; force?: boolean },
  signal?: AbortSignal,
): Promise<PutResult> {
  const res = await fetch(base(characterId), {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({
      state,
      baseUpdatedAt: opts.baseUpdatedAt,
      force: opts.force === true,
    }),
    signal,
  });
  await ensureOk(res);
  return (await res.json().catch(() => ({}))) as PutResult;
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
