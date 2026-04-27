import { useState, type ReactNode } from "react";
import type { Cantrip } from "@/types/character";
import Icon from "../ui/Icon";
import { SpellComponentsText } from "../SpellComponentsText";
import { SCHOOL_COLORS, SCHOOL_ICONS } from "@/lib/constants";

export default function CompactCantripRow({ spell }: { spell: Cantrip }) {
  const [open, setOpen] = useState(false);
  const school = SCHOOL_COLORS[spell.school];

  return (
    <div className="bg-surface-container-low border border-outline-variant/40 rounded-md hover:border-primary/40 transition">
      <button
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className={`shrink-0 w-6 h-6 inline-flex items-center justify-center rounded text-[9px] font-bold ${school.chip}`}
          title={spell.school}
        >
          0
        </span>
        <Icon name={SCHOOL_ICONS[spell.school]} size={14} className="text-primary/60 shrink-0" />
        <span className="font-serif text-sm text-on-surface truncate flex-1">{spell.name}</span>
        {spell.source === "race" && (
          <span
            title="Granted by race / lineage"
            className="shrink-0 chip text-[9px] px-1.5 py-0 border bg-secondary/10 text-secondary border-secondary/30"
          >
            Racial
          </span>
        )}
        {spell.source === "feat" && (
          <span
            title="Granted by a feat"
            className="shrink-0 chip text-[9px] px-1.5 py-0 border bg-tertiary/10 text-tertiary border-tertiary/30"
          >
            Feat
          </span>
        )}
        {spell.source === "subclass" && (
          <span
            title="Granted by subclass"
            className="shrink-0 chip text-[9px] px-1.5 py-0 border bg-primary/10 text-primary border-primary/30"
          >
            Subclass
          </span>
        )}
        <Icon name={open ? "expand_less" : "expand_more"} size={16} className="text-outline shrink-0" />
      </button>
      {open && (
        <div className="px-2 pb-2 pt-1 border-t border-outline-variant/30 animate-fade-in">
          <div className="grid grid-cols-2 gap-x-2 text-[10px]">
            {spell.castingTime && <Meta label="Cast" value={spell.castingTime} />}
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
