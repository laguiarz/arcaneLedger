import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import {
  fetchLibraryCharacter,
  fetchLibraryManifest,
} from "@/lib/characterLibrary";
import { useCharacter } from "@/store/character";
import type { CharacterSummary } from "@/types/characterLibrary";

interface Props {
  /** Fires after a successful load. The picker has already updated the store. */
  onLoaded?: (id: string, name: string) => void;
  /** Optional secondary action rendered next to the main header (e.g. "Use sample"). */
  trailingAction?: React.ReactNode;
  /** Show a compact variant suitable for embedding inside Settings. */
  variant?: "default" | "compact";
}

export default function LibraryPicker({
  onLoaded,
  trailingAction,
  variant = "default",
}: Props) {
  const loadCharacter = useCharacter((s) => s.loadCharacter);
  const activeId = useCharacter((s) => s.activeCharacterId);

  const [summaries, setSummaries] = useState<CharacterSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setListError(null);
    setSummaries(null);
    try {
      const list = await fetchLibraryManifest();
      setSummaries(list);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handlePick = async (s: CharacterSummary) => {
    setLoadingId(s.id);
    setLoadError(null);
    try {
      const character = await fetchLibraryCharacter(s.id);
      // Record which revision this is, or the header would immediately offer to
      // reload the character the user just picked.
      loadCharacter(character, { sourceId: s.id, revision: s.revision ?? null });
      onLoaded?.(s.id, character.name);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className={variant === "compact" ? "space-y-sm" : "space-y-md"}>
      {trailingAction && (
        <div className="flex justify-end">{trailingAction}</div>
      )}

      {listError && (
        <div className="flex items-start gap-sm border border-error/40 bg-error/10 rounded-md px-sm py-2 text-sm text-error">
          <Icon name="error" className="mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Couldn&apos;t load the library.</p>
            <p className="text-xs opacity-80">{listError}</p>
          </div>
          <button
            className="btn-ghost !py-1 !px-2 text-xs"
            onClick={() => void refresh()}
          >
            <Icon name="refresh" /> Retry
          </button>
        </div>
      )}

      {!listError && summaries === null && (
        <div className="flex items-center gap-sm text-sm text-on-surface-variant py-md">
          <Icon name="hourglass_top" className="animate-pulse" />
          Loading library…
        </div>
      )}

      {!listError && summaries?.length === 0 && (
        <div className="text-sm text-on-surface-variant border border-outline-variant/40 rounded-md px-sm py-md">
          The library is empty. Add a JSON to <code>public/characters/</code>{" "}
          and register it in <code>manifest.json</code>.
        </div>
      )}

      {summaries && summaries.length > 0 && (
        <ul className="space-y-xs">
          {summaries.map((s) => {
            const isActive = activeId === s.id;
            const isLoading = loadingId === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => void handlePick(s)}
                  disabled={isLoading || loadingId !== null}
                  className={`w-full text-left flex items-center gap-sm rounded-lg border px-sm py-2 transition ${
                    isActive
                      ? "border-primary/60 bg-primary/10"
                      : "border-outline-variant/30 bg-surface-container-lowest hover:border-primary/40 hover:bg-primary/5"
                  } disabled:opacity-50`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-xs">
                      <span className="font-serif text-title-sm text-primary truncate">
                        {s.name}
                      </span>
                      {isActive && (
                        <span className="text-[10px] uppercase tracking-wider text-secondary border border-secondary/40 bg-secondary/10 rounded px-1 py-0.5">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant truncate">
                      {s.className} · Level {s.level}
                    </p>
                  </div>
                  <Icon
                    name={isLoading ? "hourglass_top" : "arrow_forward"}
                    className={`text-on-surface-variant ${
                      isLoading ? "animate-pulse" : ""
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {loadError && (
        <p className="text-sm text-error border border-error/40 bg-error/10 rounded-md px-sm py-2">
          {loadError}
        </p>
      )}
    </div>
  );
}
