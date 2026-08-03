/**
 * Should the header offer to reload the character from the library?
 *
 * Pure and store-free for the same reason `syncFlags.ts` is: the header imports
 * the service-worker store, which imports `virtual:pwa-register` and cannot run
 * under Vitest, so anything worth testing lives here instead.
 */

export type LibraryNotice =
  /** Nothing to say. */
  | "none"
  /** The library advertises a different revision than the one we loaded. */
  | "update"
  /** We don't know which revision this sheet came from. Not the same claim. */
  | "unknown";

/** Ids that are not library characters and can never be reloaded from it. */
function isLibraryOrigin(id: string | null): boolean {
  return id !== null && id !== "sample" && id !== "custom";
}

export function libraryNotice(a: {
  activeCharacterId: string | null;
  /** `libraryRevision` from the character store. */
  loadedRevision: string | null;
  /** Revision the manifest advertises, or null if unchecked/unavailable. */
  availableRevision: string | null;
  /** A new app build is waiting to be installed. */
  appUpdatePending: boolean;
}): LibraryNotice {
  // The app update ALWAYS wins. PR #23 shipped app code and brunella.json in one
  // deploy, and the manifest is fetched live even on a stale bundle — so both
  // buttons would appear at once. Reloading the sheet first runs it under the
  // old code, the new content still doesn't render, and the reload looks broken.
  if (a.appUpdatePending) return "none";

  if (!isLibraryOrigin(a.activeCharacterId)) return "none";

  // Never checked, offline, entry removed from the manifest, or a manifest older
  // than revisions. Silence beats a claim we cannot support.
  if (a.availableRevision === null) return "none";

  // Loaded before revisions existed. We genuinely don't know, so we say so
  // rather than assert a newer version exists — but we still offer the reload,
  // because assuming "current" hides exactly the bug this feature exists to fix.
  // Self-healing: one reload records a revision and this never fires again.
  if (a.loadedRevision === null) return "unknown";

  return a.loadedRevision === a.availableRevision ? "none" : "update";
}
