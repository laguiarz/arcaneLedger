/// <reference types="vite/client" />

/** Short git SHA of the build, injected by vite.config.ts. `"dev"` if unknown. */
declare const __APP_COMMIT__: string;
/** ISO timestamp of the build, injected by vite.config.ts. */
declare const __APP_BUILD_TIME__: string;

interface ImportMetaEnv {
  /**
   * Gemini API key for the DIRECT dev fallback only. Injected from
   * process.env.GEMINI_KEY by vite.config.ts during `vite serve`, or set in a
   * local .env. Never injected in production builds (the key lives server-side
   * in the /api/narrate function).
   */
  readonly VITE_GEMINI_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
