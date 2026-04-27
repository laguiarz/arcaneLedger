import { useState } from "react";
import { useCharacter } from "@/store/character";
import Icon from "../ui/Icon";

export default function HpPanel() {
  const c = useCharacter((s) => s.character);
  const takeDamage = useCharacter((s) => s.takeDamage);
  const heal = useCharacter((s) => s.heal);
  const setTempHp = useCharacter((s) => s.setTempHp);

  const [delta, setDelta] = useState<string>("");
  const [tempInput, setTempInput] = useState<string>("");

  const pct = Math.max(0, Math.min(100, (c.hp.current / Math.max(1, c.hp.max)) * 100));

  // Conic gauge. Use #e9c176 for the fill ring.
  const gaugeStyle: React.CSSProperties = {
    background: `conic-gradient(#e9c176 0% ${pct}%, #38342e ${pct}% 100%)`,
  };

  const apply = (op: "damage" | "heal") => {
    const n = Math.max(0, parseInt(delta, 10));
    if (!n || Number.isNaN(n)) return;
    if (op === "damage") takeDamage(n);
    else heal(n);
    setDelta("");
  };

  return (
    <div className="relative glass-card brass-border rounded-xl p-md shadow-2xl overflow-hidden">
      <div className="leather-noise absolute inset-0" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="label-caps text-primary/80">Vitality Core</span>
          <div className="flex items-center gap-2">
            <span
              title="Hit Dice — spend on a short rest to heal"
              className="inline-flex items-center gap-1 chip text-[10px] px-1.5 py-0 border bg-primary/10 text-primary border-primary/30"
            >
              <Icon name="casino" size={12} />
              HD {c.hitDice.max - c.hitDice.spent}/{c.hitDice.max}
              <span className="text-outline">d{c.hitDice.die}</span>
            </span>
            <Icon name="favorite" filled className="text-error text-lg" />
          </div>
        </div>

        <div className="flex flex-col items-center mt-sm gap-sm">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full" style={gaugeStyle} />
            <div className="absolute inset-2 rounded-full bg-surface-container-low border border-amber-900/30" />
            <div className="relative text-center">
              <div className="font-serif text-display-lg text-primary leading-none">{c.hp.current}</div>
              <div className="label-caps text-on-surface-variant mt-1">OF {c.hp.max} HP</div>
              {c.hp.temp > 0 && (
                <div className="label-caps text-tertiary mt-1">+{c.hp.temp} TEMP</div>
              )}
            </div>
          </div>

          <div className="w-full space-y-2">
            <input
              id="hp-delta"
              name="hp-delta"
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="Amount"
              className="input-inset w-full text-center font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") apply("heal");
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                className="btn-ghost !text-error !border-error/40 hover:!bg-error/10"
                onClick={() => apply("damage")}
                aria-label="Take damage"
              >
                <Icon name="bloodtype" /> Damage
              </button>
              <button
                className="btn-ghost !text-secondary !border-secondary/40 hover:!bg-secondary/10"
                onClick={() => apply("heal")}
                aria-label="Heal"
              >
                <Icon name="healing" /> Heal
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2 w-full pt-2 border-t border-outline-variant/30">
            <input
              id="hp-temp"
              name="hp-temp"
              type="number"
              value={tempInput}
              onChange={(e) => setTempInput(e.target.value)}
              placeholder="Temp HP"
              className="input-inset text-center font-mono"
            />
            <button
              className="btn-ghost"
              onClick={() => {
                const n = Math.max(0, parseInt(tempInput, 10) || 0);
                setTempHp(n);
                setTempInput("");
              }}
            >
              Set Temp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
