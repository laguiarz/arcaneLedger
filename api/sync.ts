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
 * Writes use optimistic concurrency, not last-write-wins on a client stamp: the
 * client sends the `updatedAt` it last applied and the server writes only if it
 * still matches (or the user forced it). `updatedAt` is stamped by the SERVER,
 * so no device clock can order anything, and the response reports whether the
 * write actually happened — it used to answer `{ok:true}` for writes it threw
 * away, which made a device show a green tick while its data went nowhere.
 *
 * Known limitation: the read-then-write is not atomic. Two concurrent PUTs can
 * both pass the check. Acceptable for a single user; fixing it needs a Lua
 * script or a WATCH/MULTI equivalent.
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

    // --- PUT: compare-and-set the state and/or append a combat ------------
    if (req.method === "PUT") {
      const body: {
        state?: SyncedState;
        combat?: CombatRecord;
        /** The stamp the client last applied; `null` if it never synced. */
        baseUpdatedAt?: number | null;
        /** Set by a user-initiated save after they have seen the conflict. */
        force?: boolean;
      } =
        typeof req.body === "string"
          ? JSON.parse(req.body || "{}")
          : ((req.body as Record<string, never>) ?? {});

      let applied: boolean | undefined;
      let stamp: number | undefined;

      if (body.state) {
        const existing = await readJson<SyncedState | null>(stateKey, null);
        // Optimistic concurrency, NOT last-write-wins on a client stamp: write
        // when nothing exists, when the client based its edit on exactly what
        // we hold, or when the user forced it after seeing the conflict. No
        // client clock is compared — the server stamps the write itself, so a
        // device with a skewed clock can neither lose nor steal a write.
        const ok =
          !existing ||
          body.baseUpdatedAt === existing.updatedAt ||
          body.force === true;
        if (ok) {
          stamp = Date.now();
          await writeJson(stateKey, { ...body.state, updatedAt: stamp });
          applied = true;
        } else {
          stamp = existing.updatedAt;
          applied = false;
        }
      }

      // Combat records are immutable and idempotent by id — always appended.
      if (body.combat && body.combat.id) {
        const combats = await readJson<CombatRecord[]>(combatsKey, []);
        if (!combats.some((c) => c.id === body.combat!.id)) {
          combats.push(body.combat);
          await writeJson(combatsKey, combats);
        }
      }

      // `applied`/`updatedAt` are omitted when the request carried no state, so
      // a combat-only PUT never reads as a rejected state write.
      res.status(200).json({
        ok: true,
        ...(applied === undefined ? {} : { applied, updatedAt: stamp }),
      });
      return;
    }

    res.status(405).json({ error: "Method not allowed." });
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
