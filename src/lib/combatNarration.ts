/**
 * Persistence + defaults for the AI combat-narration feature.
 *
 * Combat state itself is ephemeral, but the narration *configuration* (API key,
 * model, editable prompt) is a setting the user shouldn't have to re-enter each
 * fight, so it lives in localStorage. The key can also come from the build-time
 * `GEMINI_KEY` env var (injected via `vite.config.ts`) so it never has to be
 * pasted by hand on this machine.
 */

const KEY_API = "al.gemini.key";
const KEY_MODEL = "al.gemini.model";
const KEY_PROMPT = "al.combat.narrationPrompt";

/** Cheap, fast, current Gemini model — the "branch barato". */
export const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Models that used to be the default but no longer serve `generateContent`
 * (they 404 even though ListModels still reports them). A stored value matching
 * one of these is treated as stale and auto-healed back to {@link DEFAULT_MODEL}
 * so an early tester isn't stuck with a dead model saved in localStorage.
 */
const RETIRED_MODELS = new Set(["gemini-2.0-flash", "gemini-2.0-flash-001"]);

/**
 * Default, fully editable system prompt. Written in Spanish to match Brunella's
 * voice. Instructs the model to narrate in-character and to lean on its own
 * knowledge of monster lore to color terse action notes ("engulf" → a vivid
 * description of the ooze swallowing its prey).
 */
export const DEFAULT_NARRATION_PROMPT = `Sos Brunella, barda de la Universidad del Saber, elfa de Myth Drannor. Narrás en primera persona la crónica de un combate que acabás de vivir, con tu estilo poético y épico, en español rioplatense culto pero cálido.

Pautas:
- Convertí el registro seco de rondas y acciones en un relato fluido y vívido, NO en una lista. Hilá las rondas como una historia.
- Usá tu conocimiento del bestiario y del setting (Reinos Olvidados / D&D 5e) para darle color a las acciones. Si una acción dice solo "engulf" y la criatura es un cubo gelatinoso, describí cómo la gelatina envuelve y disuelve a su presa; si dice "muerde" y es un lobo huargo, evocá colmillos y la cacería en jauría.
- Respetá los hechos del registro (quién actuó, contra quién, qué condiciones cayeron). No inventes muertes ni resultados que no figuren.
- Tono: heroico, con guiños de humor bárdico y alguna metáfora luminosa. Largo: 3 a 6 párrafos.
- Cerrá con una pequeña moraleja o copla breve, como cierre de juglar.`;

function read(key: string): string | null {
  try {
    return typeof window !== "undefined"
      ? window.localStorage.getItem(key)
      : null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode, quota) — silently ignore */
  }
}

/**
 * Local key for the DIRECT dev fallback only. In production the key lives
 * server-side in /api/narrate and this returns "" — narration goes through the
 * proxy and needs no client key.
 */
export function getApiKey(): string {
  const stored = read(KEY_API);
  if (stored && stored.trim()) return stored.trim();
  const env = (import.meta.env as ImportMetaEnv).VITE_GEMINI_KEY;
  return env?.trim() ?? "";
}

export function setApiKey(value: string): void {
  write(KEY_API, value.trim());
}

export function getModel(): string {
  const stored = read(KEY_MODEL)?.trim();
  if (!stored || RETIRED_MODELS.has(stored)) return DEFAULT_MODEL;
  return stored;
}

export function setModel(value: string): void {
  write(KEY_MODEL, value.trim() || DEFAULT_MODEL);
}

/**
 * The narration prompt is now a per-character sheet field
 * ({@link Character.narrationPrompt}). These helpers only deal with the pre-
 * migration GLOBAL prompt so it can be adopted once into the active character.
 */

/** The legacy global prompt, or "" if none was ever saved. */
export function getLegacyGlobalPrompt(): string {
  return read(KEY_PROMPT)?.trim() ?? "";
}

/** Remove the legacy global prompt once it has been adopted by a character. */
export function clearLegacyGlobalPrompt(): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(KEY_PROMPT);
  } catch {
    /* storage unavailable — ignore */
  }
}

/** The prompt actually used for a character: its own, else the default. */
export function effectiveNarrationPrompt(prompt: string | undefined): string {
  return prompt && prompt.trim() ? prompt : DEFAULT_NARRATION_PROMPT;
}
