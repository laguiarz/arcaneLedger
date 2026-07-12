/**
 * Vercel serverless sync endpoint for a single character.
 *
 * Stores two keys in Upstash Redis:
 *   char:{id}:state    → the durable state blob { updatedAt, sheet, coin }
 *   char:{id}:combats  → an array of immutable CombatRecord
 *
 * Auth: a single shared secret (process.env.SYNC_SECRET) sent as
 * `Authorization: Bearer <secret>`. Single-user app — this is enough.
 *
 * Self-contained on purpose (no imports from src/) so it bundles as a standalone
 * function, like api/narrate.ts. Requires env vars:
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, SYNC_SECRET
 */

interface Req {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}
interface Res {
  status: (code: number) => Res;
  json: (body: unknown) => void;
}

interface SyncedState {
  updatedAt: number;
  sheet: unknown;
  coin: unknown;
}
interface CombatRecord {
  id: string;
  endedAt: number;
  [k: string]: unknown;
}

/** Run one Redis command via the Upstash REST endpoint. Returns `result`. */
async function redis(command: unknown[]): Promise<unknown> {
  // Vercel's Upstash Marketplace integration injects KV_REST_API_* names; the
  // UPSTASH_REDIS_REST_* names are the fallback if wired up by hand.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Server is missing Upstash/KV env vars.");
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error(`Upstash error: ${r.status} ${r.statusText}`);
  const data = (await r.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(`Upstash error: ${data.error}`);
  return data.result ?? null;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = (await redis(["GET", key])) as string | null;
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await redis(["SET", key, JSON.stringify(value)]);
}

function firstParam(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function handler(req: Req, res: Res): Promise<void> {
  // --- Auth ---------------------------------------------------------------
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Server is missing the SYNC_SECRET env var." });
    return;
  }
  const auth = firstParam(req.headers?.authorization);
  if (auth !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const characterId = firstParam(req.query?.characterId).trim();
  if (!characterId) {
    res.status(400).json({ error: "Missing characterId." });
    return;
  }

  const stateKey = `char:${characterId}:state`;
  const combatsKey = `char:${characterId}:combats`;

  try {
    // --- GET: return the whole bundle ------------------------------------
    if (req.method === "GET") {
      const [state, combats] = await Promise.all([
        readJson<SyncedState | null>(stateKey, null),
        readJson<CombatRecord[]>(combatsKey, []),
      ]);
      res.status(200).json({ state, combats });
      return;
    }

    // --- PUT: upsert state (LWW) and/or append a combat (idempotent) -----
    if (req.method === "PUT") {
      const body: { state?: SyncedState; combat?: CombatRecord } =
        typeof req.body === "string"
          ? JSON.parse(req.body || "{}")
          : ((req.body as { state?: SyncedState; combat?: CombatRecord }) ?? {});

      if (body.state) {
        const existing = await readJson<SyncedState | null>(stateKey, null);
        // Last-write-wins: only overwrite when the incoming stamp is >=.
        if (!existing || body.state.updatedAt >= existing.updatedAt) {
          await writeJson(stateKey, body.state);
        }
      }

      if (body.combat && body.combat.id) {
        const combats = await readJson<CombatRecord[]>(combatsKey, []);
        if (!combats.some((c) => c.id === body.combat!.id)) {
          combats.push(body.combat);
          await writeJson(combatsKey, combats);
        }
      }

      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed." });
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
