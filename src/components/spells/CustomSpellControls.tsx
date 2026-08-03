import { useEffect, useState } from "react";
import { useCharacter } from "@/store/character";
import Icon from "@/components/ui/Icon";
import type { Cantrip, Spell } from "@/types/character";

/**
 * Edit + delete for a player-authored spell. Delete is a two-step inline
 * confirm rather than a dialog: a hand-typed description is real work to lose,
 * but a modal on every delete is the interruption the user has already
 * rejected elsewhere.
 */
export default function CustomSpellControls({
  spell,
  onEdit,
}: {
  spell: Spell | Cantrip;
  onEdit?: (s: Spell | Cantrip) => void;
}) {
  const remove = useCharacter((s) => s.removeCustomSpell);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <>
      {onEdit && (
        <button
          type="button"
          className="btn-icon"
          aria-label="Edit spell"
          title="Edit spell"
          onClick={() => onEdit(spell)}
        >
          <Icon name="edit" />
        </button>
      )}
      <button
        type="button"
        className={`btn-icon ${confirming ? "!text-error !border-error/50 !bg-error/15" : ""}`}
        aria-label={confirming ? "Confirm delete" : "Delete spell"}
        title={confirming ? "Tap again to delete" : "Delete spell"}
        onClick={() => {
          if (confirming) remove(spell.name);
          else setConfirming(true);
        }}
      >
        <Icon name={confirming ? "delete_forever" : "delete"} />
      </button>
    </>
  );
}

/** The badge that says "you wrote this one". */
export function CustomChip() {
  return (
    <span className="chip bg-primary-container/60 text-primary border border-primary/30">
      Custom
    </span>
  );
}
