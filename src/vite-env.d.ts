/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Gemini API key, injected from process.env.GEMINI_KEY in vite.config.ts. */
  readonly GEMINI_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
