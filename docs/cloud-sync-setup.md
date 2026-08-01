# Cloud Sync — setup (free tier)

The sync feature is offline-first: the app works fully without any of this. These
steps only turn on cross-device sync. Everything below sits on **free tiers**.

## 1. Create an Upstash Redis database (free)

1. In the Vercel dashboard → your project → **Storage** → **Marketplace** →
   **Upstash** → create a **Redis** database (or create it at upstash.com and
   copy the REST credentials). The free plan (~500K commands/month, 256 MB) is
   far more than a single-user companion needs.
2. Connecting the store to the project auto-injects the REST credentials as
   **`KV_REST_API_URL`** and **`KV_REST_API_TOKEN`** (Production + Preview). The
   function reads those names (falling back to `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN` if you wire them by hand). No manual step needed.

## 2. Set the shared secret

Pick any long random string — this is the only auth between your devices and the
serverless endpoint.

In Vercel → project → **Settings → Environment Variables**, add (Production +
Preview):

| Name | Value |
|------|-------|
| `SYNC_SECRET` | your long random string |

(The `KV_REST_API_*` vars come from the Upstash integration automatically.)

Redeploy so the `/api/sync` function picks up the new secret.

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

`npm run dev` serves `/api/sync` via a dev-only Vite middleware (see
`devApiSync` in `vite.config.ts`), so you can exercise sync locally without
`vercel dev` (whose proxy breaks Vite's HMR client → blank screen).

It needs the credentials in a git-ignored `.env.local`:

```
KV_REST_API_URL="https://<your-db>.upstash.io"
KV_REST_API_TOKEN="<token>"
SYNC_SECRET="<your secret>"
```

`vercel env pull .env.local` returns Sensitive/integration vars as empty, so
copy the two `KV_REST_API_*` values from the Vercel Storage → your DB →
".env.local" snippet, and set `SYNC_SECRET` to the same string you type in the
app's Settings. Without these, the app still runs — sync just reports
error/offline and no-ops.
