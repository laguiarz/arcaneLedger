import type { Character } from "@/types/character";
import type {
  CharacterSummary,
  LibraryManifest,
} from "@/types/characterLibrary";

/**
 * Static cloud character library.
 *
 * Characters are served as JSON files from `/characters/<id>.json`, alongside
 * a `/characters/manifest.json` index. Everything lives under `public/` so
 * Vercel serves them as static assets, the PWA can precache them, and there
 * is no backend to maintain. Adding a character = drop the JSON + edit the
 * manifest + deploy.
 */

const MANIFEST_URL = "/characters/manifest.json";

const characterUrl = (id: string) =>
  `/characters/${encodeURIComponent(id)}.json`;

export async function fetchLibraryManifest(): Promise<CharacterSummary[]> {
  let res: Response;
  try {
    res = await fetch(MANIFEST_URL, { cache: "no-cache" });
  } catch (e) {
    throw new Error(
      `Could not reach the character library (network error: ${
        e instanceof Error ? e.message : String(e)
      }).`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `Failed to load library manifest (HTTP ${res.status} ${res.statusText}).`,
    );
  }
  const data = (await res.json()) as LibraryManifest | CharacterSummary[];
  // Tolerate either a bare array or the versioned envelope.
  const list = Array.isArray(data) ? data : data.characters;
  if (!Array.isArray(list)) {
    throw new Error("Library manifest is malformed (expected a list).");
  }
  return list.filter(
    (c): c is CharacterSummary =>
      !!c && typeof c.id === "string" && typeof c.name === "string",
  );
}

export async function fetchLibraryCharacter(id: string): Promise<Character> {
  let res: Response;
  try {
    res = await fetch(characterUrl(id), { cache: "no-cache" });
  } catch (e) {
    throw new Error(
      `Could not load "${id}" (network error: ${
        e instanceof Error ? e.message : String(e)
      }).`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `Failed to load character "${id}" (HTTP ${res.status} ${res.statusText}).`,
    );
  }
  const data = (await res.json()) as Character;
  if (!data?.name || !data.abilities || !data.hp) {
    throw new Error(
      `Character "${id}" is malformed (missing required fields).`,
    );
  }
  return data;
}
