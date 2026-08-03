import { create } from "zustand";
import {
  fetchLibraryCharacter,
  fetchLibraryManifest,
} from "@/lib/characterLibrary";
import { useCharacter } from "./character";
import { useSync, withHydration } from "./sync";

/**
 * Knows whether the cloud library holds a different version of the character
 * you are playing.
 *
 * Deliberately separate from `useSync`: that store short-circuits on
 * `isSyncEnabled()`, and this check has to work with cloud sync switched off.
 * They are two independent axes of staleness — Upstash holds YOUR edits, the
 * library holds the PUBLISHED sheet — and folding them together would either
 * break that guarantee or tangle the flags.
 *
 * Nothing is persisted: the revision the manifest advertises is a fact about
 * right now, and a stale one on disk would be worse than no answer.
 */

interface LibraryState {
  /** Revision the manifest advertises for the ACTIVE character. */
  availableRevision: string | null;
  /** A background manifest check is in flight. Must NOT disable the button. */
  checking: boolean;
  /** A user-initiated reload is in flight. Disables the button. */
  reloading: boolean;
  lastError: string | null;

  check: () => Promise<void>;
  reload: () => Promise<void>;
}

/** Ids that came from the library. "sample"/"custom"/null did not. */
export function isLibraryId(id: string | null): id is string {
  return id !== null && id !== "sample" && id !== "custom";
}

function activeLibraryId(): string | null {
  const id = useCharacter.getState().activeCharacterId;
  return isLibraryId(id) ? id : null;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const useLibrary = create<LibraryState>()((set, get) => ({
  availableRevision: null,
  checking: false,
  reloading: false,
  lastError: null,

  check: async () => {
    const id = activeLibraryId();
    if (id === null) return;
    set({ checking: true });
    try {
      const entries = await fetchLibraryManifest();
      // A SUCCESSFUL check always writes the answer, including null when the
      // entry has gone from the manifest — otherwise a revision seen once would
      // pin the notice open forever.
      set({
        availableRevision:
          entries.find((e) => e.id === id)?.revision ?? null,
        lastError: null,
      });
    } catch (e) {
      // A FAILED check leaves the last known revision alone. It must never read
      // as "you are up to date" and never as "there is an update".
      set({ lastError: message(e) });
    } finally {
      set({ checking: false });
    }
  },

  reload: async () => {
    if (get().reloading) return;
    const id = activeLibraryId();
    if (id === null) return;
    set({ reloading: true });
    try {
      // The manifest is re-fetched HERE, and the revision recorded is the one
      // this fetch saw. Using the stored `availableRevision` would be a race:
      // check() fires on focus/online, so a deploy landing while the character
      // fetch is in flight would stamp the new revision onto the old content
      // and silence the notice permanently.
      const [entries, character] = await Promise.all([
        fetchLibraryManifest(),
        fetchLibraryCharacter(id),
      ]);
      const revision = entries.find((e) => e.id === id)?.revision ?? null;

      withHydration(() =>
        useCharacter
          .getState()
          .loadCharacter(character, { sourceId: id, revision }),
      );
      // The flags still have to catch up, so the header can offer Guardar if the
      // reloaded sheet changed anything durable.
      useSync.getState().recompute();

      set({ availableRevision: revision, lastError: null });
    } catch (e) {
      set({ lastError: message(e) });
    } finally {
      set({ reloading: false });
    }
  },
}));
