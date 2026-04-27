import { useEffect, useState } from "react";
import { useCharacter, findSpell } from "@/store/character";
import Icon from "../ui/Icon";

export default function ConcentrationBar() {
  const conc = useCharacter((s) => s.character.concentration);
  const drop = useCharacter((s) => s.dropConcentration);
  const bump = useCharacter((s) => s.bumpConcentrationRounds);
  const character = useCharacter((s) => s.character);
  const [showDesc, setShowDesc] = useState(false);

  // Reset description toggle when concentration spell changes
  useEffect(() => {
    setShowDesc(false);
  }, [conc?.spellName]);

  if (!conc) {
    return (
      <div className="flex items-center gap-2 text-xs text-outline italic px-sm py-2 rounded-md border border-dashed border-outline-variant/40">
        <Icon name="psychology_alt" size={16} />
        Not concentrating on any spell.
      </div>
    );
  }

  const spell = findSpell(character, conc.spellName);

  return (
    <div className="bg-tertiary-container/30 border border-tertiary/50 rounded-lg px-sm py-2 shadow-[0_0_15px_rgba(176,198,249,0.15)]">
      <div className="flex items-center gap-sm flex-wrap">
        <Icon name="all_inclusive" filled className="text-tertiary text-xl" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="label-caps text-tertiary">Concentrating</span>
            <span className="font-serif text-on-surface text-base truncate">{conc.spellName}</span>
            <span className="chip bg-tertiary/15 text-tertiary border border-tertiary/30">
              L{conc.level}
            </span>
          </div>
          {spell?.duration && (
            <div className="text-[11px] text-on-surface-variant truncate">{spell.duration}</div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="label-caps text-outline mr-1">Round</span>
          <button className="btn-icon" onClick={() => bump(-1)} aria-label="Previous round" disabled={conc.rounds <= 0}>
            <Icon name="remove" />
          </button>
          <span className="font-mono text-tertiary w-6 text-center">{conc.rounds}</span>
          <button className="btn-icon" onClick={() => bump(1)} aria-label="Next round">
            <Icon name="add" />
          </button>
        </div>

        {spell?.desc && (
          <button
            className="btn-icon"
            onClick={() => setShowDesc((o) => !o)}
            aria-label="Toggle description"
            title="Toggle description"
          >
            <Icon name={showDesc ? "expand_less" : "expand_more"} />
          </button>
        )}

        <button
          className="btn-ghost !text-error !border-error/40 hover:!bg-error/10"
          onClick={drop}
        >
          <Icon name="close" /> Drop
        </button>
      </div>

      {showDesc && spell?.desc && (
        <p className="text-xs text-on-surface-variant italic mt-2 pt-2 border-t border-tertiary/30">
          {spell.desc}
        </p>
      )}
    </div>
  );
}
