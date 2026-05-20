/**
 * Cloud character library types.
 *
 * The library is a tiny static catalog hosted at /characters/ alongside the
 * built app. The manifest lists summaries for the picker UI; the full
 * Character is fetched only when the user selects one.
 */

export interface CharacterSummary {
  /** Stable id used as the filename (e.g. "lyari" → /characters/lyari.json). */
  id: string;
  name: string;
  /** Display label e.g. "Wizard (Illusionist)". */
  className: string;
  level: number;
}

export interface LibraryManifest {
  version: number;
  characters: CharacterSummary[];
}
