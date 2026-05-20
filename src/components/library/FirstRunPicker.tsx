import { useState } from "react";
import Icon from "@/components/ui/Icon";
import LibraryPicker from "./LibraryPicker";
import { useCharacter } from "@/store/character";

/**
 * Full-screen, non-dismissable picker shown when no character has been
 * chosen yet (activeCharacterId === null). Blocks interaction with the rest
 * of the app until the user picks one from the cloud library, falls back to
 * the sample wizard, or jumps to Settings to import a file.
 */
export default function FirstRunPicker() {
  const resetToSample = useCharacter((s) => s.resetToSample);
  const [confirmingSample, setConfirmingSample] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-sm bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-surface-container border border-primary/30 rounded-xl shadow-2xl overflow-hidden">
        <div className="leather-noise absolute inset-0" />
        <div className="relative p-md md:p-lg">
          <div className="flex items-center gap-sm mb-md">
            <Icon name="auto_stories" className="text-primary text-3xl" />
            <div>
              <h2 className="font-serif text-headline-md text-primary leading-tight">
                Choose a character
              </h2>
              <p className="text-on-surface-variant text-sm">
                Load a character from the party library to begin.
              </p>
            </div>
          </div>

          <LibraryPicker />

          <div className="mt-md pt-md border-t border-outline-variant/40 text-xs text-on-surface-variant space-y-2">
            <p>
              Not yours? Open{" "}
              <span className="text-primary font-medium">Settings</span> after
              loading any character to import a JSON / XML file directly.
            </p>
            {!confirmingSample ? (
              <button
                className="text-secondary hover:underline"
                onClick={() => setConfirmingSample(true)}
              >
                or use the sample wizard
              </button>
            ) : (
              <div className="flex items-center gap-xs">
                <span>Use sample wizard?</span>
                <button
                  className="btn-ghost !py-1 !px-2 text-xs"
                  onClick={() => resetToSample()}
                >
                  Yes
                </button>
                <button
                  className="btn-ghost !py-1 !px-2 text-xs"
                  onClick={() => setConfirmingSample(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
