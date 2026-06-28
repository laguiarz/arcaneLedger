import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import { useCombat } from "@/store/combat";

/**
 * Editor for a single (combatant, round) action cell. The player types what
 * they did ("bites Lyari", "casts Vicious Mockery") or just marks that the
 * combatant acted with no detail.
 */
export default function ActionCellModal({
  target,
  onClose,
}: {
  target: { combatantId: string; round: number } | null;
  onClose: () => void;
}) {
  const combatant = useCombat((s) =>
    s.combatants.find((c) => c.id === target?.combatantId),
  );
  const setAction = useCombat((s) => s.setAction);
  const toggleActed = useCombat((s) => s.toggleActed);

  const existing = target ? combatant?.actions[target.round] : undefined;
  const [text, setText] = useState("");

  useEffect(() => {
    setText(existing?.text ?? "");
    // Re-seed whenever a different cell is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.combatantId, target?.round]);

  if (!target || !combatant) return null;

  const save = () => {
    setAction(combatant.id, target.round, text);
    onClose();
  };

  const markActedOnly = () => {
    setAction(combatant.id, target.round, "");
    if (!combatant.actions[target.round]?.acted) {
      toggleActed(combatant.id, target.round);
    }
    onClose();
  };

  const clear = () => {
    setAction(combatant.id, target.round, "");
    if (combatant.actions[target.round]?.acted) {
      toggleActed(combatant.id, target.round);
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${combatant.name} — Round ${target.round}`}
      width="max-w-md"
    >
      <div className="space-y-md">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
          placeholder="e.g. casts Vicious Mockery at the ogre · engulfs Lyari · Dodge"
          className="input-inset w-full h-28 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-brass" onClick={save}>
            <Icon name="check" /> Save action
          </button>
          <button className="btn-ghost" onClick={markActedOnly}>
            <Icon name="task_alt" /> Acted (no detail)
          </button>
          <button
            className="btn-ghost !text-error !border-error/40 ml-auto"
            onClick={clear}
          >
            <Icon name="backspace" /> Clear
          </button>
        </div>
        <p className="text-[11px] text-outline italic">
          ⌘/Ctrl+Enter to save. These notes feed the end-of-combat narration.
        </p>
      </div>
    </Modal>
  );
}
