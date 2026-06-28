/// <reference types="vite/client" />

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
