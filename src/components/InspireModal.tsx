import { useState } from "react";
import Modal from "./ui/Modal";
import Icon from "./ui/Icon";
import { useCharacter } from "@/store/character";
import { nextInspirePhrases } from "@/lib/inspirePhraseRotation";
import type { InspireTag } from "@/data/inspirePhrases";

type Count = 1 | 5;

/**
 * State + render for the inspire-phrase modal. The returned `draw` opens the
 * modal and shows phrases for the current tag/count selection. State persists
 * across opens so the user keeps their preferred mode.
 */
export function useInspire(deckName: string | undefined) {
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState<InspireTag>("combat");
  const [count, setCount] = useState<Count>(1);
  const [phrases, setPhrases] = useState<string[]>([]);
  const speakerName = useCharacter((s) => s.character.name.split(" ")[0]);

  const drawWith = (nextTag: InspireTag, nextCount: Count) => {
    if (!deckName) return;
    setTag(nextTag);
    setCount(nextCount);
    setPhrases(nextInspirePhrases(deckName, nextTag, nextCount));
    setOpen(true);
  };

  const draw = () => drawWith(tag, count);
  const reroll = () => drawWith(tag, count);
  const close = () => setOpen(false);

  const modal = (
    <Modal open={open} onClose={close} title="Una palabra para vos" width="max-w-md">
      <div className="space-y-md">
        <div className="grid grid-cols-2 gap-2">
          <Segment>
            <SegBtn active={tag === "combat"} onClick={() => drawWith("combat", count)} icon="swords" label="Combate" />
            <SegBtn active={tag === "task"} onClick={() => drawWith("task", count)} icon="track_changes" label="Tarea" />
          </Segment>
          <Segment>
            <SegBtn active={count === 1} onClick={() => drawWith(tag, 1)} label="1" />
            <SegBtn active={count === 5} onClick={() => drawWith(tag, 5)} label="5" />
          </Segment>
        </div>

        {phrases.length > 0 && (
          <div className={count === 1 ? "" : "space-y-2.5 max-h-[50vh] overflow-y-auto pr-1"}>
            {phrases.map((p, i) => (
              <blockquote
                key={`${p}-${i}`}
                className={
                  count === 1
                    ? "font-serif text-on-surface text-lg leading-relaxed italic text-balance"
                    : "font-serif text-on-surface text-sm leading-snug italic flex gap-2"
                }
              >
                {count > 1 && (
                  <span className="text-tertiary font-bold shrink-0 w-5 text-right">{i + 1}.</span>
                )}
                <span>
                  <span className="text-tertiary mr-1">“</span>
                  {p}
                  <span className="text-tertiary ml-1">”</span>
                </span>
              </blockquote>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-sm pt-sm border-t border-outline-variant/30">
          <span className="text-xs text-outline italic">— {speakerName}, en voz baja</span>
          <button
            onClick={reroll}
            className="btn-text text-tertiary hover:bg-tertiary/10 flex items-center gap-1"
          >
            <Icon name="auto_awesome" size={14} filled />
            {count > 1 ? "Otras" : "Otra"}
          </button>
        </div>
      </div>
    </Modal>
  );

  return { draw, modal, enabled: !!deckName };
}

function Segment({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-1 p-1 bg-surface-container-low border border-outline-variant/40 rounded-lg">
      {children}
    </div>
  );
}

function SegBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md transition text-sm font-medium ${
        active
          ? "bg-tertiary/20 text-tertiary border border-tertiary/40 shadow-sm"
          : "text-on-surface-variant border border-transparent hover:bg-surface-container-highest"
      }`}
    >
      {icon && <Icon name={icon} size={14} filled={active} />}
      {label}
    </button>
  );
}
