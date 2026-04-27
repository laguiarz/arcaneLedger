import { useCharacter } from "@/store/character";
import { CONDITIONS } from "@/lib/constants";
import Icon from "../ui/Icon";

export default function ConditionsPanel() {
  const c = useCharacter((s) => s.character);
  const toggle = useCharacter((s) => s.toggleCondition);
  const setExhaustion = useCharacter((s) => s.setExhaustion);

  return (
    <div className="bg-surface-container border border-amber-900/30 rounded-xl p-md relative overflow-hidden">
      <div className="leather-noise absolute inset-0" />
      <div className="relative">
        <div className="flex items-baseline justify-between mb-sm">
          <h3 className="font-serif text-title-sm text-primary">Conditions</h3>
          <span className="text-xs text-outline">
            {c.conditions.active.length + (c.conditions.exhaustion > 0 ? 1 : 0)} active
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {CONDITIONS.map((cond) => {
            const active = c.conditions.active.includes(cond.id);
            return (
              <button
                key={cond.id}
                onClick={() => toggle(cond.id)}
                title={cond.desc}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-md border text-left transition active:scale-[0.98] ${
                  active
                    ? "bg-error/15 border-error/50 text-error shadow-[0_0_10px_rgba(255,180,171,0.15)]"
                    : "bg-surface-container-low border-outline-variant/40 text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
                }`}
              >
                <Icon name={cond.icon} filled={active} size={18} />
                <span className="text-xs font-bold tracking-wide">{cond.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-sm pt-sm border-t border-outline-variant/30 flex items-center justify-between">
          <div>
            <span className="label-caps text-primary">Exhaustion</span>
            <span className="ml-2 text-on-surface-variant text-sm">
              Level {c.conditions.exhaustion} / 6
            </span>
          </div>
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => setExhaustion(n)}
                aria-label={`Exhaustion level ${n}`}
                className={`w-6 h-6 rounded-full text-xs font-mono border transition ${
                  n <= c.conditions.exhaustion
                    ? "bg-error/40 border-error text-error-container"
                    : "bg-surface-container-low border-outline-variant/40 text-outline hover:border-primary/40"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
