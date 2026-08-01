import { useState } from "react";
import { useCharacter } from "@/store/character";
import { useCombatLog, recordsForCharacter } from "@/store/combatLog";
import { buildNarrationPayload } from "@/lib/combatLog";
import type { CombatRecord } from "@/types/combatLog";
import Icon from "@/components/ui/Icon";
import NarrationModal from "@/components/combat/NarrationModal";

/**
 * The "Crónica" tab inside /combat: browse finished combats for the active
 * character, read the transcript, (re)generate Brunella's narration, delete.
 */
export default function ChronicleTab() {
  const character = useCharacter((s) => s.character);
  const activeCharacterId = useCharacter((s) => s.activeCharacterId);
  const cid = activeCharacterId ?? "custom";
  const records = useCombatLog((s) => s.records);
  const mine = recordsForCharacter(records, cid);

  const [narrateFor, setNarrateFor] = useState<CombatRecord | null>(null);

  if (mine.length === 0) {
    return (
      <p className="text-sm text-outline italic px-2 py-8 text-center">
        Todavía no hay combates en la crónica. Terminá un combate con “End &amp;
        narrate” y quedará guardado acá.
      </p>
    );
  }

  return (
    <div className="space-y-sm">
      {mine.map((rec) => (
        <ChronicleEntry
          key={rec.id}
          record={rec}
          activeName={character.name}
          onNarrate={() => setNarrateFor(rec)}
        />
      ))}

      <NarrationModal
        open={narrateFor !== null}
        onClose={() => setNarrateFor(null)}
        combatants={narrateFor?.combatants ?? []}
        totalRounds={narrateFor?.rounds ?? 1}
        activeName={character.name}
        onNarrated={(text) => {
          if (narrateFor) useCombatLog.getState().setNarration(narrateFor.id, text);
        }}
      />
    </div>
  );
}

function ChronicleEntry({
  record,
  activeName,
  onNarrate,
}: {
  record: CombatRecord;
  activeName?: string;
  onNarrate: () => void;
}) {
  const remove = useCombatLog((s) => s.remove);
  const [showTranscript, setShowTranscript] = useState(false);

  const when = new Date(record.endedAt).toLocaleString();
  const title = record.title?.trim() || when;
  const foes = record.combatants.filter((c) => c.kind === "monster").length;
  const transcript = buildNarrationPayload(
    record.combatants,
    record.rounds,
    activeName,
  );

  return (
    <article className="bg-surface-container border border-outline-variant/30 rounded-lg p-sm space-y-sm">
      <header className="flex items-center gap-2 flex-wrap">
        <Icon name="menu_book" className="text-primary" filled />
        <span className="font-serif text-title-sm text-on-surface">{title}</span>
        <span className="text-[11px] text-outline">
          {record.rounds} {record.rounds === 1 ? "ronda" : "rondas"}
          {foes > 0 && ` · ${foes} ${foes === 1 ? "enemigo" : "enemigos"}`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button className="btn-ghost !py-1" onClick={onNarrate}>
            <Icon name="auto_stories" filled />
            {record.narration ? "Re-narrar" : "Narrar"}
          </button>
          <button
            className="btn-icon !text-error"
            aria-label="Borrar de la crónica"
            onClick={() => {
              if (confirm("¿Borrar este combate de la crónica?")) remove(record.id);
            }}
          >
            <Icon name="delete" size={18} />
          </button>
        </div>
      </header>

      {record.narration && (
        <div className="font-serif text-on-surface text-[15px] leading-relaxed whitespace-pre-wrap border-l-2 border-primary/40 pl-md">
          {record.narration}
        </div>
      )}

      <button
        className="flex items-center gap-1 text-xs text-outline hover:text-on-surface transition"
        onClick={() => setShowTranscript((v) => !v)}
      >
        <Icon name={showTranscript ? "expand_less" : "expand_more"} size={16} />
        {showTranscript ? "Ocultar registro" : "Ver registro"}
      </button>
      {showTranscript && (
        <pre className="text-[11px] leading-relaxed text-on-surface-variant whitespace-pre-wrap font-mono bg-surface-container-low border border-outline-variant/30 rounded-md p-sm max-h-[40vh] overflow-y-auto">
          {transcript}
        </pre>
      )}
    </article>
  );
}
