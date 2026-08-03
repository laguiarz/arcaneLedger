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
  /**
   * Content digest of the character JSON, stamped by scripts/stampLibrary.mjs.
   * Optional: a manifest published before revisions existed has none, and the
   * app must stay silent rather than guess when it is missing.
   */
  revision?: string;
}

export interface LibraryManifest {
  version: number;
  characters: CharacterSummary[];
}
