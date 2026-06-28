import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import { CONDITIONS } from "@/lib/constants";
import { useCombat } from "@/store/combat";

/**
 * Per-combatant condition editor. Toggling a condition on reveals a small
 * duration stepper (rounds); leaving it at 0 keeps the condition indefinite
 * (it won't auto-expire when the round advances).
 */
export default function ConditionsModal({
  combatantId,
  open,
  onClose,
}: {
  combatantId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const combatant = useCombat((s) =>
    s.combatants.find((c) => c.id === combatantId),
  );
  const toggle = useCombat((s) => s.toggleCondition);
  const setRounds = useCombat((s) => s.setConditionRounds);

  if (!combatant) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Conditions — ${combatant.name}`}
      width="max-w-lg"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {CONDITIONS.map((cond) => {
          const active = combatant.conditions.find((x) => x.id === cond.id);
          return (
            <div
              key={cond.id}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-2 transition ${
                active
                  ? "bg-error/15 border-error/50"
                  : "bg-surface-container-low border-outline-variant/40"
              }`}
            >
              <button
                onClick={() => toggle(combatant.id, cond.id)}
                title={cond.desc}
                className={`flex items-center gap-2 flex-1 text-left ${
                  active ? "text-error" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Icon name={cond.icon} filled={!!active} size={18} />
                <span className="text-xs font-bold tracking-wide">{cond.label}</span>
              </button>
              {active && (
                <label className="flex items-center gap-1 text-[10px] text-outline shrink-0">
                  <span className="uppercase tracking-wider">rounds</span>
                  <input
                    type="number"
                    min={0}
                    value={active.rounds ?? ""}
                    placeholder="∞"
                    onChange={(e) =>
                      setRounds(
                        combatant.id,
                        cond.id,
                        e.target.value === "" ? undefined : Number(e.target.value),
                      )
                    }
                    className="input-inset !py-0.5 !px-1 w-12 text-center font-mono text-xs"
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-sm text-[11px] text-outline italic">
        Leave rounds empty for an indefinite condition. Timed conditions count
        down each time you advance the round.
      </p>
    </Modal>
  );
}
