import { useState, type ReactNode } from "react";
import { useCharacter, freeCastsRemaining } from "@/store/character";
import type { Spell, SpellLevel } from "@/types/character";
import Icon from "../ui/Icon";
import { SpellComponentsText } from "../SpellComponentsText";
import { SCHOOL_COLORS, SCHOOL_ICONS, SPELL_LEVELS } from "@/lib/constants";

export default function CompactSpellRow({ spell }: { spell: Spell }) {
  const c = useCharacter((s) => s.character);
  const cast = useCharacter((s) => s.castSpell);
  const castFree = useCharacter((s) => s.castSpellFree);
  const concentrating = c.concentration?.spellName === spell.name;

  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);

  const validLevels = SPELL_LEVELS.filter(
    (lvl) => lvl >= spell.level && (c.spellSlotsMax[lvl] ?? 0) > 0,
  );
  const anyAvail = validLevels.some((lvl) => (c.spellSlots[lvl] ?? 0) > 0);

  const freeMax = spell.freeCastsPerLongRest ?? 0;
  const freeLeft = freeMax > 0 ? freeCastsRemaining(c, spell.name) : 0;
  const totalOptions = (freeLeft > 0 ? 1 : 0) + validLevels.length;
  const canCast = freeLeft > 0 || anyAvail;

  const onCastAt = (lvl: SpellLevel) => {
    cast(lvl, spell.concentration ? { concentration: { spellName: spell.name } } : undefined);
    setPicking(false);
  };

  const onCastFree = () => {
    castFree(
      spell.name,
      spell.concentration ? { concentration: { level: spell.level } } : undefined,
    );
    setPicking(false);
  };

  const onCastClick = () => {
    if (!canCast) return;
    if (totalOptions === 1) {
      if (freeLeft > 0) onCastFree();
      else onCastAt(validLevels[0]);
    } else {
      setPicking((p) => !p);
    }
  };

  const school = SCHOOL_COLORS[spell.school];

  return (
    <div
      className={`bg-surface-container-low border rounded-md transition ${
        concentrating
          ? "border-tertiary/60 shadow-[0_0_8px_rgba(176,198,249,0.2)]"
          : "border-outline-variant/40 hover:border-primary/40"
      }`}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span
          className={`shrink-0 w-6 h-6 inline-flex items-center justify-center rounded text-[10px] font-bold ${school.chip}`}
          title={spell.school}
        >
          {spell.level}
        </span>
        <button
          className="flex-1 min-w-0 text-left flex items-center gap-2"
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name={SCHOOL_ICONS[spell.school]} size={14} className="text-primary/60 shrink-0" />
          <span className="font-serif text-sm text-on-surface truncate">{spell.name}</span>
          {spell.concentration && (
            <span title="Requires concentration" className="inline-flex">
              <Icon
                name="all_inclusive"
                size={12}
                className={concentrating ? "text-tertiary" : "text-outline"}
              />
            </span>
          )}
          {spell.ritual && (
            <span title="Ritual" className="inline-flex">
              <Icon name="auto_stories" size={12} className="text-outline" />
            </span>
          )}
          {freeMax > 0 && (
            <span
              title="Innate spell · free cast per long rest, then costs a slot"
              className={`shrink-0 chip text-[9px] px-1.5 py-0 border ${
                freeLeft > 0
                  ? "bg-secondary/15 text-secondary border-secondary/40"
                  : "bg-surface-container-high text-outline border-outline-variant/40"
              }`}
            >
              Innate {freeLeft}/{freeMax}
            </span>
          )}
        </button>
        <button
          onClick={onCastClick}
          disabled={!canCast}
          className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md border transition ${
            freeLeft > 0
              ? "bg-secondary/15 border-secondary/50 text-secondary hover:bg-secondary/25"
              : canCast
                ? "bg-primary/15 border-primary/50 text-primary hover:bg-primary/25"
                : "bg-surface-container-low border-outline-variant/40 text-outline cursor-not-allowed"
          }`}
          aria-label="Cast"
          title={
            !canCast
              ? "No slots & no free cast"
              : freeLeft > 0
                ? totalOptions === 1
                  ? "Cast (free)"
                  : "Cast — choose free or slot"
                : "Cast"
          }
        >
          <Icon name="bolt" filled size={16} />
        </button>
        <button
          className="shrink-0 btn-icon !w-7 !h-7"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle details"
        >
          <Icon name={open ? "expand_less" : "expand_more"} size={16} />
        </button>
      </div>

      {picking && (
        <div className="px-2 pb-2 flex flex-wrap gap-1 animate-fade-in">
          {freeLeft > 0 && (
            <button
              onClick={onCastFree}
              className="px-2 py-0.5 rounded text-[10px] font-bold border transition bg-secondary/15 text-secondary border-secondary/50 hover:bg-secondary/25 ring-1 ring-secondary/40"
              title="Free racial cast — no slot spent"
            >
              FREE <span className="text-secondary/70">({freeLeft}/{freeMax})</span>
            </button>
          )}
          {validLevels.map((lvl) => {
            const cur = c.spellSlots[lvl] ?? 0;
            const max = c.spellSlotsMax[lvl] ?? 0;
            const out = cur === 0;
            return (
              <button
                key={lvl}
                disabled={out}
                onClick={() => onCastAt(lvl)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                  out
                    ? "bg-surface-container-low text-outline border-outline-variant/40 cursor-not-allowed"
                    : "bg-surface-container-high text-primary border-primary/40 hover:bg-primary/15"
                } ${lvl === spell.level ? "ring-1 ring-primary/40" : ""}`}
              >
                L{lvl} <span className="text-outline">({cur}/{max})</span>
              </button>
            );
          })}
        </div>
      )}

      {open && (
        <div className="px-2 pb-2 pt-1 border-t border-outline-variant/30 animate-fade-in">
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] mt-1">
            {spell.castingTime && (
              <Meta label="Cast" value={spell.castingTime} />
            )}
            {spell.range && <Meta label="Range" value={spell.range} />}
            {spell.duration && <Meta label="Dur" value={spell.duration} />}
            {spell.components && (
              <Meta
                label="Comp"
                value={
                  <SpellComponentsText
                    components={spell.components}
                    stripped={spell.componentsStripped}
                  />
                }
              />
            )}
          </div>
          {spell.desc && (
            <p className="text-[11px] text-on-surface-variant italic mt-1.5 leading-snug">
              {spell.desc}
            </p>
          )}
          {spell.upcastNote && (
            <p className="text-[10px] text-primary/80 mt-1">
              <span className="font-bold">Upcast:</span> {spell.upcastNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1 min-w-0">
      <span className="label-caps text-outline text-[9px] shrink-0">{label}</span>
      <span className="text-on-surface-variant truncate">{value}</span>
    </div>
  );
}
