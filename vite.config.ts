import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Dev-only middleware that serves the `api/sync.ts` serverless function from the
 * Vite dev server, so `npm run dev` exercises cloud sync locally without needing
 * `vercel dev` (whose proxy breaks Vite's HMR client). No effect on production
 * builds — the real function runs on Vercel there. Reads KV/secret env from
 * `.env.local` (non-VITE vars aren't otherwise exposed to server code).
 */
function devApiSync(): Plugin {
  const KEYS = [
    "SYNC_SECRET",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ];
  return {
    name: "dev-api-sync",
    apply: "serve",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      for (const k of KEYS) {
        if (env[k] && !process.env[k]) process.env[k] = env[k];
      }
      server.middlewares.use(async (req, res, next) => {
        if ((req.url || "").split("?")[0] !== "/api/sync") return next();
        try {
          const u = new URL(req.url || "", "http://localhost");
          const query = Object.fromEntries(u.searchParams);
          let body = "";
          for await (const chunk of req) body += chunk;
          const vReq = { method: req.method, headers: req.headers, query, body };
          const vRes = {
            status(code: number) {
              res.statusCode = code;
              return vRes;
            },
            json(obj: unknown) {
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify(obj));
            },
          };
          const mod = await server.ssrLoadModule("/api/sync.ts");
          await (mod.default as (rq: unknown, rs: unknown) => Promise<void>)(vReq, vRes);
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        }
      });
    },
  };
}

/**
 * Short commit for the running build. Vercel exposes the full SHA as an env
 * var; locally we ask git. Wrapped in try/catch so a build from a tarball with
 * no `.git` still succeeds.
 */
function appCommit(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 7);
  try {
    // execFileSync, not execSync: no shell is spawned at all.
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

export default defineConfig(({ command }) => ({
  define: {
    // Build identity, surfaced in Settings → "Acerca de" so a device can say
    // exactly which build it is running.
    __APP_COMMIT__: JSON.stringify(appCommit()),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    // Dev only: expose the OS GEMINI_KEY to the client as VITE_GEMINI_KEY so
    // the direct fallback works under `npm run dev`. Production builds inject
    // NOTHING — the key stays server-side in the /api/narrate function and is
    // never baked into the client bundle.
    ...(command === "serve"
      ? {
          "import.meta.env.VITE_GEMINI_KEY": JSON.stringify(
            process.env.GEMINI_KEY ?? "",
          ),
        }
      : {}),
  },
  plugins: [
    devApiSync(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Arcanist's Ledger",
        short_name: "Arcanist's",
        description: "D&D 5e in-session companion",
        theme_color: "#110e09",
        background_color: "#110e09",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "gfonts-css" },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "gfonts-files",
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
  },
}));
