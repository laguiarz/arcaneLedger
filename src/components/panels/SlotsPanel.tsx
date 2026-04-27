import { useCharacter } from "@/store/character";
import type { SpellLevel } from "@/types/character";
import Icon from "../ui/Icon";
import { levelLabel, SPELL_LEVELS } from "@/lib/constants";

interface Props {
  /** When true, slot pips are clickable to toggle used/recovered. */
  interactive?: boolean;
}

export default function SlotsPanel({ interactive = true }: Props) {
  const c = useCharacter((s) => s.character);
  const cast = useCharacter((s) => s.castSpell);
  const refund = useCharacter((s) => s.refundSlot);

  const usable = SPELL_LEVELS.filter((lvl) => (c.spellSlotsMax[lvl] ?? 0) > 0);
  if (usable.length === 0) {
    return (
      <div className="text-sm text-outline italic">No spell slots available.</div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-sm">
      {usable.map((lvl) => (
        <SlotTier
          key={lvl}
          level={lvl}
          max={c.spellSlotsMax[lvl] ?? 0}
          available={c.spellSlots[lvl] ?? 0}
          onSpend={interactive ? () => cast(lvl) : undefined}
          onRefund={interactive ? () => refund(lvl) : undefined}
        />
      ))}
    </div>
  );
}

function SlotTier({
  level,
  max,
  available,
  onSpend,
  onRefund,
}: {
  level: SpellLevel;
  max: number;
  available: number;
  onSpend?: () => void;
  onRefund?: () => void;
}) {
  return (
    <div className="relative bg-surface-container border border-amber-900/30 rounded-xl p-sm overflow-hidden">
      <div className="leather-noise absolute inset-0" />
      <div className="relative">
        <div className="flex justify-between items-end mb-2">
          <span className="label-caps text-primary text-[10px]">Level {levelLabel(level)}</span>
          <span className="font-serif text-sm">
            {available}
            <span className="text-outline">/{max}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: max }).map((_, i) => {
            const filled = i < available;
            return (
              <button
                key={i}
                disabled={!onSpend}
                onClick={() => {
                  if (filled) onSpend?.();
                  else onRefund?.();
                }}
                aria-label={filled ? `Spend slot ${i + 1}` : `Recover slot ${i + 1}`}
                className={`w-5 h-8 rounded-sm transition active:scale-90 ${
                  filled
                    ? "bg-primary shadow-[0_0_8px_rgba(233,193,118,0.55)] border border-primary-fixed"
                    : "bg-surface-container-highest border border-amber-900/50 hover:border-primary/40"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SlotsPickerInline({
  onPick,
  disabledLevels = [],
}: {
  onPick: (lvl: SpellLevel) => void;
  disabledLevels?: SpellLevel[];
}) {
  const c = useCharacter((s) => s.character);
  const usable = SPELL_LEVELS.filter((lvl) => (c.spellSlotsMax[lvl] ?? 0) > 0);

  return (
    <div className="flex flex-wrap gap-1.5">
      {usable.map((lvl) => {
        const cur = c.spellSlots[lvl] ?? 0;
        const max = c.spellSlotsMax[lvl] ?? 0;
        const out = cur === 0 || disabledLevels.includes(lvl);
        return (
          <button
            key={lvl}
            disabled={out}
            onClick={() => onPick(lvl)}
            className={`px-2 py-1 rounded-md text-xs font-bold border transition ${
              out
                ? "bg-surface-container-low text-outline border-outline-variant/40 cursor-not-allowed"
                : "bg-surface-container-high text-primary border-primary/40 hover:bg-primary/15 hover:border-primary"
            }`}
          >
            <Icon name="bolt" filled size={14} className="-mb-0.5 mr-1" />
            L{lvl} <span className="text-outline">({cur}/{max})</span>
          </button>
        );
      })}
    </div>
  );
}
