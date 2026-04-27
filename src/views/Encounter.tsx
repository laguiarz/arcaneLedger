import { useMemo } from "react";
import { useCharacter, preparedNonRituals, preparedRituals } from "@/store/character";
import type { Spell } from "@/types/character";
import { SPELL_LEVELS } from "@/lib/constants";
import Icon from "@/components/ui/Icon";
import ConcentrationBar from "@/components/panels/ConcentrationBar";
import CompactSpellRow from "@/components/encounter/CompactSpellRow";
import CompactCantripRow from "@/components/encounter/CompactCantripRow";
import CompactResourceRow from "@/components/encounter/CompactResourceRow";

export default function Encounter() {
  const c = useCharacter((s) => s.character);
  const takeDamage = useCharacter((s) => s.takeDamage);
  const heal = useCharacter((s) => s.heal);
  const cast = useCharacter((s) => s.castSpell);
  const refund = useCharacter((s) => s.refundSlot);

  const prepared = useMemo(() => {
    const a = preparedNonRituals(c);
    const b = preparedRituals(c);
    return [...a, ...b].sort((x, y) => x.level - y.level || x.name.localeCompare(y.name));
  }, [c]);

  const usableLevels = SPELL_LEVELS.filter((lvl) => (c.spellSlotsMax[lvl] ?? 0) > 0);

  return (
    <div className="max-w-7xl mx-auto p-sm md:p-md space-y-sm">
      {/* Combat Strip: HP + Slots + Concentration */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-sm items-stretch">
        <HpStrip onDamage={takeDamage} onHeal={heal} />

        <div className="lg:col-span-7 bg-surface-container border border-amber-900/30 rounded-lg p-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="label-caps text-primary">Spell Slots</span>
            <span className="text-[10px] text-outline">tap to spend / recover</span>
          </div>
          <div className="flex flex-wrap gap-sm">
            {usableLevels.length === 0 && (
              <span className="text-xs text-outline italic">No slots configured.</span>
            )}
            {usableLevels.map((lvl) => {
              const max = c.spellSlotsMax[lvl] ?? 0;
              const cur = c.spellSlots[lvl] ?? 0;
              return (
                <div key={lvl} className="flex items-center gap-1.5">
                  <span className="label-caps text-outline text-[10px]">L{lvl}</span>
                  <div className="flex gap-1">
                    {Array.from({ length: max }).map((_, i) => {
                      const filled = i < cur;
                      return (
                        <button
                          key={i}
                          onClick={() => (filled ? cast(lvl) : refund(lvl))}
                          aria-label={filled ? "Spend slot" : "Recover slot"}
                          className={`w-3.5 h-6 rounded-sm transition active:scale-90 ${
                            filled
                              ? "bg-primary shadow-[0_0_6px_rgba(233,193,118,0.5)] border border-primary-fixed"
                              : "bg-surface-container-highest border border-amber-900/50 hover:border-primary/40"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <ConcentrationBar />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-sm">
        {/* Abilities & Items + Cantrips */}
        <div className="space-y-2">
          <SubHeader icon="inventory_2" label="Abilities & Items" count={c.resources.length} />
          {c.resources.length === 0 && (
            <EmptyHint text="No tracked features." />
          )}
          {c.resources.map((r, i) => (
            <CompactResourceRow key={r.id ?? r.name + i} resource={r} />
          ))}

          <SubHeader icon="flash_on" label="Cantrips" count={c.cantrips.length} />
          {c.cantrips.map((s) => (
            <CompactCantripRow key={s.name} spell={s} />
          ))}
        </div>

        {/* Innate + Prepared Spells */}
        <div className="space-y-2">
          {c.innateSpells.length > 0 && (
            <>
              <SubHeader
                icon="diamond"
                label="Innate Casting"
                count={c.innateSpells.length}
              />
              {c.innateSpells.map((s) => (
                <CompactSpellRow key={`innate-${s.name}`} spell={s} />
              ))}
            </>
          )}
          <SubHeader icon="auto_fix_high" label="Prepared Spells" count={prepared.length} />
          <PreparedGrouped spells={prepared} />
        </div>
      </section>
    </div>
  );
}

function HpStrip({
  onDamage,
  onHeal,
}: {
  onDamage: (n: number) => void;
  onHeal: (n: number) => void;
}) {
  const c = useCharacter((s) => s.character);
  const pct = Math.max(0, Math.min(100, (c.hp.current / Math.max(1, c.hp.max)) * 100));

  const apply = (op: "damage" | "heal") => {
    const input = (document.getElementById("encounter-delta") as HTMLInputElement | null);
    if (!input) return;
    const n = Math.max(0, parseInt(input.value, 10) || 0);
    if (!n) return;
    if (op === "damage") onDamage(n);
    else onHeal(n);
    input.value = "";
  };

  return (
    <div className="lg:col-span-5 bg-surface-container border border-amber-900/30 rounded-lg p-sm flex items-center gap-sm">
      <div
        className="relative w-16 h-16 shrink-0 flex items-center justify-center"
        style={{ background: `conic-gradient(#e9c176 0% ${pct}%, #38342e ${pct}% 100%)`, borderRadius: "50%" }}
        aria-label={`HP ${c.hp.current} of ${c.hp.max}`}
      >
        <div className="absolute inset-1 rounded-full bg-surface-container-low border border-amber-900/30" />
        <div className="relative text-center">
          <div className="font-serif text-primary text-lg leading-none">{c.hp.current}</div>
          <div className="text-[8px] text-outline">/ {c.hp.max}</div>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[11px] text-outline">
          {c.hp.temp > 0 && (
            <span className="text-tertiary font-bold">+{c.hp.temp} temp</span>
          )}
          {c.ac != null && (
            <span>
              AC <span className="text-primary font-bold">{c.ac}</span>
            </span>
          )}
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
            id="encounter-delta"
            name="encounter-delta"
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
        </div>
      </div>
    </div>
  );
}

function SubHeader({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mt-2 first:mt-0">
      <Icon name={icon} className="text-primary/80" size={16} />
      <h3 className="label-caps text-primary">{label}</h3>
      <span className="text-[10px] text-outline">({count})</span>
      <span className="flex-1 h-px bg-outline-variant/40 ml-1" />
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="text-xs text-outline italic px-2 py-1">{text}</p>
  );
}

function PreparedGrouped({ spells }: { spells: Spell[] }) {
  const grouped = useMemo(() => {
    const m = new Map<number, Spell[]>();
    for (const s of spells) {
      const arr = m.get(s.level) ?? [];
      arr.push(s);
      m.set(s.level, arr);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [spells]);

  if (spells.length === 0) {
    return <EmptyHint text="No prepared spells." />;
  }

  return (
    <div className="space-y-2">
      {grouped.map(([lvl, list]) => (
        <div key={lvl} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="label-caps text-outline text-[10px]">Level {lvl}</span>
            <span className="flex-1 h-px bg-outline-variant/30" />
          </div>
          {list.map((s) => (
            <CompactSpellRow key={s.name} spell={s} />
          ))}
        </div>
      ))}
    </div>
  );
}
