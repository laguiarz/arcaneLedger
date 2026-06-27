import { useEffect, useState } from "react";
import Modal from "./ui/Modal";
import Icon from "./ui/Icon";
import { useCharacter } from "@/store/character";
import { rollSkillCheck, type SkillCheckResult } from "@/lib/dice";
import type { SkillName } from "@/types/character";

type Phase = "spinning" | "settled";

function fmt(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * State + render for the skill-check roll overlay. The returned `roll` opens the
 * overlay, rolls a 1d20 for the given skill, animates a tumbling die, and shows
 * the settled result. Mirrors the `useInspire` pattern: mount `modal` once and
 * thread `roll` down to each skill row.
 */
export function useSkillRoll() {
  const c = useCharacter((s) => s.character);

  const [open, setOpen] = useState(false);
  const [skill, setSkill] = useState<SkillName | null>(null);
  const [label, setLabel] = useState("");
  const [result, setResult] = useState<SkillCheckResult | null>(null);
  const [phase, setPhase] = useState<Phase>("settled");
  const [face, setFace] = useState(20);
  const [rollId, setRollId] = useState(0);

  const roll = (sk: SkillName, lbl: string) => {
    setSkill(sk);
    setLabel(lbl);
    setResult(rollSkillCheck(c, sk));
    setOpen(true);
    setRollId((id) => id + 1);
  };

  const close = () => setOpen(false);

  // Drive the tumble animation whenever a new roll starts.
  useEffect(() => {
    if (rollId === 0 || !result) return;
    if (prefersReducedMotion()) {
      setFace(result.natural);
      setPhase("settled");
      return;
    }
    setPhase("spinning");
    const tick = setInterval(() => setFace(Math.floor(Math.random() * 20) + 1), 60);
    const stop = setTimeout(() => {
      clearInterval(tick);
      setFace(result.natural);
      setPhase("settled");
    }, 700);
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
    };
    // rollId is the trigger; result is set in the same batch as rollId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollId]);

  const settled = phase === "settled";
  const isNat20 = settled && result?.natural === 20;
  const isNat1 = settled && result?.natural === 1;

  const dieTone = isNat20
    ? "text-primary drop-shadow-[0_0_12px_rgba(233,193,118,0.7)]"
    : isNat1
      ? "text-error/80"
      : "text-primary";

  const modal = (
    <Modal open={open} onClose={close} title={label || "Skill Check"} width="max-w-sm">
      <div className="flex flex-col items-center gap-md py-sm">
        <div
          key={rollId}
          className={`relative ${settled ? "animate-die-settle" : "animate-die-tumble"}`}
        >
          <D20 className={dieTone} />
          <span
            className={`absolute inset-0 flex items-center justify-center font-serif text-3xl ${
              isNat1 ? "text-error" : "text-on-primary"
            } ${settled ? "" : "blur-[1px]"}`}
            style={{ paddingTop: "0.35em" }}
          >
            {face}
          </span>
        </div>

        {settled && result && (
          <div className="text-center animate-fade-in">
            {isNat20 && (
              <p className="label-caps text-primary drop-shadow-[0_0_8px_rgba(233,193,118,0.6)]">
                ¡Natural 20!
              </p>
            )}
            {isNat1 && <p className="label-caps text-error/80">Natural 1</p>}
            <div className="font-serif text-display-lg text-primary leading-none my-1">
              {result.total}
            </div>
            <p className="font-mono text-xs text-on-surface-variant">
              d20 ({result.natural}) {fmt(result.mod)}
            </p>
          </div>
        )}

        <button
          onClick={() => skill && roll(skill, label)}
          className="btn-text text-primary hover:bg-primary/10 flex items-center gap-1.5"
        >
          <Icon name="casino" size={16} filled />
          Tirar de nuevo
        </button>
      </div>
    </Modal>
  );

  return { roll, modal };
}

/** Classic d20 silhouette: pointy-top hexagon with central facet triangle. */
function D20({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`w-28 h-28 ${className}`} aria-hidden>
      <g
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      >
        {/* outer hexagon */}
        <polygon points="50,3 92,27 92,73 50,97 8,73 8,27" />
        {/* central upward triangle */}
        <polygon points="50,30 30,64 70,64" fillOpacity="0.22" />
        {/* facet lines to the inner triangle */}
        <line x1="50" y1="3" x2="50" y2="30" />
        <line x1="92" y1="27" x2="70" y2="64" />
        <line x1="8" y1="27" x2="30" y2="64" />
        <line x1="92" y1="73" x2="70" y2="64" />
        <line x1="8" y1="73" x2="30" y2="64" />
        <line x1="50" y1="97" x2="30" y2="64" />
        <line x1="50" y1="97" x2="70" y2="64" />
      </g>
    </svg>
  );
}
