/**
 * Persistence + defaults for the AI combat-narration feature.
 *
 * Combat state itself is ephemeral, but the narration *configuration* (API key,
 * model, editable prompt) is a setting the user shouldn't have to re-enter each
 * fight, so it lives in localStorage. The key can also come from a build-time
 * env var (`VITE_OPENAI_API_KEY`) for users who prefer a `.env.local`.
 */

const KEY_API = "al.openai.key";
const KEY_MODEL = "al.openai.model";
const KEY_PROMPT = "al.combat.narrationPrompt";

/** Cheapest broadly-available chat model — the "branch barato". */
export const DEFAULT_MODEL = "gpt-4o-mini";

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

export function getApiKey(): string {
  const stored = read(KEY_API);
  if (stored && stored.trim()) return stored.trim();
  const env = (import.meta.env as Record<string, string | undefined>)
    .VITE_OPENAI_API_KEY;
  return env?.trim() ?? "";
}

export function setApiKey(value: string): void {
  write(KEY_API, value.trim());
}

export function getModel(): string {
  return read(KEY_MODEL)?.trim() || DEFAULT_MODEL;
}

export function setModel(value: string): void {
  write(KEY_MODEL, value.trim() || DEFAULT_MODEL);
}

export function getPrompt(): string {
  const stored = read(KEY_PROMPT);
  return stored && stored.trim() ? stored : DEFAULT_NARRATION_PROMPT;
}

export function setPrompt(value: string): void {
  write(KEY_PROMPT, value);
}

export function resetPrompt(): void {
  write(KEY_PROMPT, DEFAULT_NARRATION_PROMPT);
}
