import { useState, type ReactNode } from "react";
import { useCharacter } from "@/store/character";
import type { Spell, SpellLevel } from "@/types/character";
import Icon from "./ui/Icon";
import { SpellComponentsText } from "./SpellComponentsText";
import { SCHOOL_COLORS, SCHOOL_ICONS, SPELL_LEVELS } from "@/lib/constants";

interface Props {
  spell: Spell;
  /** When true, the card is rendered as a ritual-only entry (no slot needed). */
  ritualMode?: boolean;
  /** Show "prepare/unprepare" toggle (used in spellbook tab). */
  showPrepareToggle?: boolean;
}

export default function SpellCard({ spell, ritualMode = false, showPrepareToggle = false }: Props) {
  const c = useCharacter((s) => s.character);
  const cast = useCharacter((s) => s.castSpell);
  const togglePrepared = useCharacter((s) => s.togglePrepared);

  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);

  const school = SCHOOL_COLORS[spell.school];
  const isPrepared = c.preparedSpells.includes(spell.name);

  const validUpcastLevels = SPELL_LEVELS.filter(
    (lvl) => lvl >= spell.level && (c.spellSlotsMax[lvl] ?? 0) > 0,
  );

  const anySlotAvailable = validUpcastLevels.some((lvl) => (c.spellSlots[lvl] ?? 0) > 0);

  const onCast = (lvl: SpellLevel) => {
    cast(lvl, spell.concentration ? { concentration: { spellName: spell.name } } : undefined);
    setPicking(false);
  };

  return (
    <div className="group relative bg-surface-container-high border border-amber-900/20 rounded-xl etched-top overflow-hidden">
      <div className="leather-noise absolute inset-0" />
      <div className="relative p-md">
        <div className="flex items-start justify-between gap-sm">
          <button
            type="button"
            className="flex-1 text-left"
            onClick={() => setOpen((o) => !o)}
          >
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`chip ${school.chip}`}>{spell.school}</span>
              <span className="label-caps text-outline">Level {spell.level}</span>
              {spell.ritual && (
                <span className="chip bg-secondary-container/60 text-secondary border border-secondary/30">
                  <Icon name="auto_stories" size={10} className="mr-1" /> Ritual
                </span>
              )}
              {spell.concentration && (
                <span className="chip bg-tertiary-container/60 text-tertiary border border-tertiary/30">
                  Concentration
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Icon name={SCHOOL_ICONS[spell.school]} className="text-primary/70" />
              <h3 className="font-serif text-title-sm text-primary group-hover:text-primary-fixed transition-colors">
                {spell.name}
              </h3>
            </div>
          </button>

          <div className="flex items-center gap-1">
            {showPrepareToggle && (
              <button
                onClick={() => togglePrepared(spell.name)}
                className={`btn-icon ${isPrepared ? "!text-primary !border-primary/50 !bg-primary/15" : ""}`}
                aria-label={isPrepared ? "Unprepare" : "Prepare"}
                title={isPrepared ? "Unprepare" : "Prepare"}
              >
                <Icon name="star" filled={isPrepared} />
              </button>
            )}

            {ritualMode ? (
              <button
                className="btn-brass"
                onClick={() => {
                  // Ritual cast: no slot consumed, +10 min cast time.
                  // No state change needed; the user simply tracks elapsed time in-game.
                }}
                title="Cast as ritual (no slot, +10 min)"
              >
                <Icon name="auto_stories" /> Ritual
              </button>
            ) : (
              <CastButton
                disabled={!anySlotAvailable}
                onClick={() => {
                  if (validUpcastLevels.length === 1) {
                    onCast(validUpcastLevels[0]);
                  } else {
                    setPicking((p) => !p);
                  }
                }}
              />
            )}
          </div>
        </div>

        {picking && !ritualMode && (
          <div className="mt-sm p-sm bg-surface-container-low rounded-lg border border-outline-variant/40 animate-fade-in">
            <p className="label-caps text-outline mb-2">Cast at level…</p>
            <div className="flex flex-wrap gap-1.5">
              {validUpcastLevels.map((lvl) => {
                const cur = c.spellSlots[lvl] ?? 0;
                const max = c.spellSlotsMax[lvl] ?? 0;
                const out = cur === 0;
                return (
                  <button
                    key={lvl}
                    disabled={out}
                    onClick={() => onCast(lvl)}
                    className={`px-2 py-1 rounded-md text-xs font-bold border transition ${
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
            {spell.upcastNote && (
              <p className="text-xs text-on-surface-variant italic mt-2">{spell.upcastNote}</p>
            )}
          </div>
        )}

        <SpellMeta spell={spell} />

        {spell.desc && (
          <>
            <p
              className={`text-sm text-on-surface-variant italic mt-2 whitespace-pre-line ${
                open ? "" : "line-clamp-3"
              }`}
            >
              {spell.desc}
            </p>
            {isLongDesc(spell.desc) && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:text-primary-fixed transition"
              >
                <Icon name={open ? "expand_less" : "expand_more"} size={14} />
                {open ? "Ver menos" : "Ver más"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function isLongDesc(desc: string): boolean {
  return desc.length > 120 || desc.includes("\n");
}

function CastButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn-brass ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
      title={disabled ? "No spell slots available" : "Cast"}
    >
      <Icon name="bolt" filled /> Cast
    </button>
  );
}

function SpellMeta({ spell }: { spell: Spell }) {
  const items: Array<{ label: string; value: ReactNode }> = [
    { label: "Cast Time", value: spell.castingTime },
    { label: "Range", value: spell.range },
    {
      label: "Components",
      value: spell.components ? (
        <SpellComponentsText components={spell.components} stripped={spell.componentsStripped} />
      ) : undefined,
    },
    { label: "Duration", value: spell.duration },
  ].filter((i) => i.value != null && i.value !== "");

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-sm gap-y-1 mt-sm">
      {items.map((i) => (
        <div key={i.label}>
          <span className="label-caps text-outline block text-[10px]">{i.label}</span>
          <span className="text-xs text-on-surface">{i.value}</span>
        </div>
      ))}
    </div>
  );
}

export function CantripCard({ spell }: { spell: import("@/types/character").Cantrip }) {
  const [open, setOpen] = useState(false);
  const school = SCHOOL_COLORS[spell.school];
  return (
    <div
      className="group relative glass-card brass-border rounded-xl overflow-hidden cursor-pointer"
      onClick={() => setOpen((o) => !o)}
    >
      <div className="leather-noise absolute inset-0" />
      <div className="relative p-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name={SCHOOL_ICONS[spell.school]} className="text-primary/70" />
            <span className="font-serif text-on-surface truncate">{spell.name}</span>
          </div>
          <span className={`chip ${school.chip} shrink-0`}>{spell.school}</span>
        </div>
        {open && (
          <>
            <SpellMeta spell={spell as never} />
            {spell.desc && (
              <p className="text-sm text-on-surface-variant italic mt-2">{spell.desc}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
