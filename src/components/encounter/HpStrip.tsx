import { useCharacter } from "@/store/character";
import { armorClass } from "@/lib/armor";
import Icon from "@/components/ui/Icon";

/**
 * Shared HP strip for the active character: radial HP gauge plus a single delta
 * input wired to Damage / Heal / Temp buttons. Used by both the Encounter page
 * and the Combat tracker header.
 *
 * The delta input is addressed by id so the buttons can read it without lifting
 * state; `inputId` keeps that id unique when more than one strip could mount.
 */
export default function HpStrip({
  onDamage,
  onHeal,
  onTemp,
  inputId = "encounter-delta",
  className = "lg:col-span-5",
}: {
  onDamage: (n: number) => void;
  onHeal: (n: number) => void;
  onTemp: (n: number) => void;
  inputId?: string;
  className?: string;
}) {
  const c = useCharacter((s) => s.character);
  const pct = Math.max(0, Math.min(100, (c.hp.current / Math.max(1, c.hp.max)) * 100));

  const apply = (op: "damage" | "heal" | "temp") => {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) return;
    const n = Math.max(0, parseInt(input.value, 10) || 0);
    if (!n) return;
    if (op === "damage") onDamage(n);
    else if (op === "heal") onHeal(n);
    // Temp HP doesn't stack (D&D 5e RAW): keep the higher of current vs. new.
    else onTemp(Math.max(c.hp.temp, n));
    input.value = "";
  };

  return (
    <div
      className={`bg-surface-container border border-outline-variant/30 rounded-lg p-sm flex items-center gap-sm ${className}`}
    >
      <div
        className="relative w-16 h-16 shrink-0 flex items-center justify-center"
        style={{ background: `conic-gradient(#e9c176 0% ${pct}%, #38342e ${pct}% 100%)`, borderRadius: "50%" }}
        aria-label={`HP ${c.hp.current} of ${c.hp.max}`}
      >
        <div className="absolute inset-1 rounded-full bg-surface-container-low border border-outline-variant/30" />
        <div className="relative text-center">
          <div className="font-serif text-primary text-lg leading-none">{c.hp.current}</div>
          <div className="text-[8px] text-outline">/ {c.hp.max}</div>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[11px] text-outline">
          {c.hp.temp > 0 && (
            <span className="inline-flex items-center gap-0.5 text-tertiary font-bold">
              +{c.hp.temp} temp
              <button
                type="button"
                onClick={() => onTemp(0)}
                aria-label="Clear temporary HP"
                title="Clear temporary HP"
                className="inline-flex items-center text-tertiary/70 hover:text-tertiary active:scale-90 transition"
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          )}
          <span>
            AC <span className="text-primary font-bold">{armorClass(c)}</span>
          </span>
          {c.speed != null && (
            <span>
              Speed <span className="text-primary font-bold">{c.speed}</span>
            </span>
          )}
          <span title="Hit Dice — short rest healing">
            HD <span className="text-primary font-bold">{c.hitDice.max - c.hitDice.spent}</span>
            <span className="text-outline">/{c.hitDice.max}</span>
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <input
            id={inputId}
            name={inputId}
            type="number"
            placeholder="0"
            className="input-inset !py-1 w-16 text-center font-mono text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") apply("heal");
            }}
          />
          <button
            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-error border border-error/40 hover:bg-error/10 active:scale-95 transition text-xs font-bold"
            onClick={() => apply("damage")}
          >
            <Icon name="bloodtype" size={14} /> Dmg
          </button>
          <button
            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-secondary border border-secondary/40 hover:bg-secondary/10 active:scale-95 transition text-xs font-bold"
            onClick={() => apply("heal")}
          >
            <Icon name="healing" size={14} /> Heal
          </button>
          <button
            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-tertiary border border-tertiary/40 hover:bg-tertiary/10 active:scale-95 transition text-xs font-bold"
            onClick={() => apply("temp")}
            title="Add temporary HP (keeps the higher value — D&D 5e RAW)"
          >
            <Icon name="shield" size={14} /> Temp
          </button>
        </div>
      </div>
    </div>
  );
}
