import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig(({ command }) => ({
  // Dev only: expose the OS GEMINI_KEY to the client as VITE_GEMINI_KEY so the
  // direct fallback works under `npm run dev`. In production builds we inject
  // NOTHING — the key stays server-side in the /api/narrate function and is
  // never baked into the client bundle.
  define:
    command === "serve"
      ? {
          "import.meta.env.VITE_GEMINI_KEY": JSON.stringify(
            process.env.GEMINI_KEY ?? "",
          ),
        }
      : {},
  plugins: [
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
