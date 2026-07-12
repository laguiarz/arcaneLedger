# Cloud Sync — setup (free tier)

The sync feature is offline-first: the app works fully without any of this. These
steps only turn on cross-device sync. Everything below sits on **free tiers**.

## 1. Create an Upstash Redis database (free)

1. In the Vercel dashboard → your project → **Storage** → **Marketplace** →
   **Upstash** → create a **Redis** database (or create it at upstash.com and
   copy the REST credentials). The free plan (~500K commands/month, 256 MB) is
   far more than a single-user companion needs.
2. From the database's REST section, copy **`UPSTASH_REDIS_REST_URL`** and
   **`UPSTASH_REDIS_REST_TOKEN`**. (The Vercel integration usually injects these
   env vars automatically.)

## 2. Set the shared secret

Pick any long random string — this is the only auth between your devices and the
serverless endpoint.

In Vercel → project → **Settings → Environment Variables**, add (Production +
Preview):

| Name | Value |
|------|-------|
| `UPSTASH_REDIS_REST_URL` | (from Upstash) |
| `UPSTASH_REDIS_REST_TOKEN` | (from Upstash) |
| `SYNC_SECRET` | your long random string |

Redeploy so the `/api/sync/[characterId]` function picks them up.

## 3. Enable sync in the app

On each device: **Settings → Cloud sync** → paste the **same** `SYNC_SECRET`,
tick **Activar sincronización**, and hit **Sincronizar ahora**.

- Durable edits (abilities, gold, max HP, AC, party, level) and the combat
  Chronicle sync automatically (debounced push; pull on open / focus / reconnect).
- Volatile session state (spell slots, current HP, conditions, hit dice) stays
  local and never syncs — by design.

## Conflict model

- **State**: last-write-wins by timestamp. Editing the same character on two
  devices at once means the later save wins.
- **Combat log**: append-only, merged by record id — never lost, never
  duplicated.

## Known limitation

A combat's cached AI **narration** is not propagated between devices (records
merge by id, and the append is idempotent). The combat itself syncs; re-run
"Narrar" on the other device to regenerate the ballad from the transcript.

## Local dev

`vite` alone does not run the `/api` functions. To exercise sync end-to-end
locally use `vercel dev` with the same env vars in a `.env` file. Without them,
the app still runs — sync just reports an error/offline status and no-ops.
