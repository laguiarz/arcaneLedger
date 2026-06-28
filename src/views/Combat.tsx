import { useState } from "react";
import { useCharacter } from "@/store/character";
import { useCombat } from "@/store/combat";
import { rollInitiative } from "@/lib/combat";
import { hasNarratableActions } from "@/lib/combatLog";
import { CONDITIONS } from "@/lib/constants";
import type { Combatant } from "@/types/combat";
import Icon from "@/components/ui/Icon";
import SectionHeader from "@/components/ui/SectionHeader";
import HpStrip from "@/components/encounter/HpStrip";
import AddCombatantForm from "@/components/combat/AddCombatantForm";
import ConditionsModal from "@/components/combat/ConditionsModal";
import ActionCellModal from "@/components/combat/ActionCellModal";
import NarrationModal from "@/components/combat/NarrationModal";

export default function Combat() {
  const activeName = useCharacter((s) => s.character.name);
  const takeDamage = useCharacter((s) => s.takeDamage);
  const heal = useCharacter((s) => s.heal);
  const setTempHp = useCharacter((s) => s.setTempHp);

  const combatants = useCombat((s) => s.combatants);
  const round = useCombat((s) => s.round);
  const sort = useCombat((s) => s.sort);
  const nextRound = useCombat((s) => s.nextRound);
  const reset = useCombat((s) => s.reset);

  const [conditionsFor, setConditionsFor] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<{
    combatantId: string;
    round: number;
  } | null>(null);
  const [narrateOpen, setNarrateOpen] = useState(false);

  const rounds = Array.from({ length: round }, (_, i) => i + 1);
  const canNarrate = hasNarratableActions(combatants);

  const endCombat = () => {
    if (combatants.length === 0) return;
    if (confirm("Reset the combat? All combatants, rounds and actions are wiped.")) {
      reset();
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-sm md:p-md space-y-sm">
      <SectionHeader
        icon="groups"
        title="Combat"
        subtitle="Run the party's initiative, rounds, actions and conditions"
      />

      {/* Active-character HP header (same control as the Encounter page). */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-sm items-stretch">
        <HpStrip
          onDamage={takeDamage}
          onHeal={heal}
          onTemp={setTempHp}
          inputId="combat-delta"
          className="lg:col-span-5"
        />
        <div className="lg:col-span-7 bg-surface-container border border-amber-900/30 rounded-lg p-sm flex items-center justify-between gap-sm flex-wrap">
          <div className="flex items-center gap-2">
            <Icon name="hourglass_top" className="text-primary" filled />
            <span className="font-serif text-title-sm text-primary">Round {round}</span>
            <span className="text-xs text-outline">· {activeName} active</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn-ghost !py-1" onClick={sort} title="Sort by initiative">
              <Icon name="sort" /> Sort
            </button>
            <button className="btn-brass" onClick={nextRound}>
              <Icon name="skip_next" filled /> Next round
            </button>
          </div>
        </div>
      </section>

      <AddCombatantForm />

      {combatants.length === 0 ? (
        <p className="text-sm text-outline italic px-2 py-8 text-center">
          No combatants yet. Load the party or add a monster to begin.
        </p>
      ) : (
        <div className="bg-surface-container border border-amber-900/30 rounded-lg p-sm overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th className="w-16 px-1 py-1 label-caps text-outline text-[10px]">Init</th>
                <th className="min-w-[12rem] px-2 py-1 label-caps text-outline text-[10px]">
                  Combatant
                </th>
                {rounds.map((r) => (
                  <th
                    key={r}
                    className={`w-28 px-1 py-1 label-caps text-[10px] text-center ${
                      r === round ? "text-primary" : "text-outline"
                    }`}
                  >
                    R{r}
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {combatants.map((c, i) => (
                <InitiativeRow
                  key={c.id}
                  combatant={c}
                  index={i}
                  count={combatants.length}
                  rounds={rounds}
                  currentRound={round}
                  onEditConditions={() => setConditionsFor(c.id)}
                  onEditAction={(r) => setActionTarget({ combatantId: c.id, round: r })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {combatants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-sm">
          <button
            className="btn-brass"
            onClick={() => setNarrateOpen(true)}
            disabled={!canNarrate}
            title={
              canNarrate
                ? "Generate Brunella's chronicle of the fight"
                : "Record some actions first"
            }
          >
            <Icon name="auto_stories" filled /> End &amp; narrate
          </button>
          <button
            className="btn-ghost !text-error !border-error/40 ml-auto"
            onClick={endCombat}
          >
            <Icon name="restart_alt" /> Reset combat
          </button>
        </div>
      )}

      <ConditionsModal
        combatantId={conditionsFor}
        open={conditionsFor !== null}
        onClose={() => setConditionsFor(null)}
      />
      <ActionCellModal target={actionTarget} onClose={() => setActionTarget(null)} />
      <NarrationModal
        open={narrateOpen}
        onClose={() => setNarrateOpen(false)}
        combatants={combatants}
        totalRounds={round}
        activeName={activeName}
      />
    </div>
  );
}

function InitiativeRow({
  combatant: c,
  index,
  count,
  rounds,
  currentRound,
  onEditConditions,
  onEditAction,
}: {
  combatant: Combatant;
  index: number;
  count: number;
  rounds: number[];
  currentRound: number;
  onEditConditions: () => void;
  onEditAction: (round: number) => void;
}) {
  const setInitiative = useCombat((s) => s.setInitiative);
  const setHp = useCombat((s) => s.setHp);
  const move = useCombat((s) => s.move);
  const remove = useCombat((s) => s.removeCombatant);

  return (
    <tr className="border-t border-outline-variant/20 align-top">
      {/* Initiative + roll */}
      <td className="px-1 py-1.5">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={c.initiative ?? ""}
            placeholder="—"
            onChange={(e) =>
              setInitiative(c.id, e.target.value === "" ? null : Number(e.target.value))
            }
            className="input-inset !py-0.5 !px-1 w-12 text-center font-mono text-sm"
            aria-label={`${c.name} initiative`}
          />
          <button
            className="text-outline hover:text-primary transition"
            title="Roll d20 + initiative bonus"
            onClick={() => setInitiative(c.id, rollInitiative(c.initiativeBonus ?? 0))}
          >
            <Icon name="casino" size={16} />
          </button>
        </div>
      </td>

      {/* Name + kind + HP + conditions */}
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon
            name={c.kind === "pc" ? "person" : "skull"}
            size={16}
            className={c.kind === "pc" ? "text-secondary" : "text-error"}
            filled
          />
          <span className="font-serif text-on-surface">{c.name}</span>
          {c.ac != null && (
            <span className="text-[10px] text-outline">AC {c.ac}</span>
          )}
          {c.hp && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-outline">
              <Icon name="favorite" size={12} className="text-error" filled />
              <input
                type="number"
                value={c.hp.current}
                onChange={(e) => setHp(c.id, Number(e.target.value))}
                className="input-inset !py-0 !px-1 w-12 text-center font-mono text-xs"
                aria-label={`${c.name} current HP`}
              />
              <span>/ {c.hp.max}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {c.conditions.map((cond) => {
            const meta = CONDITIONS.find((x) => x.id === cond.id);
            return (
              <span
                key={cond.id}
                className="inline-flex items-center gap-0.5 text-[10px] text-error bg-error/10 border border-error/30 rounded px-1 py-0.5"
                title={meta?.desc}
              >
                <Icon name={meta?.icon ?? "warning"} size={12} filled />
                {meta?.label ?? cond.id}
                {cond.rounds != null && (
                  <span className="font-mono text-error/80">·{cond.rounds}</span>
                )}
              </span>
            );
          })}
          <button
            className="inline-flex items-center gap-0.5 text-[10px] text-outline hover:text-primary border border-outline-variant/40 rounded px-1 py-0.5 transition"
            onClick={onEditConditions}
          >
            <Icon name="add" size={12} /> Condition
          </button>
        </div>
      </td>

      {/* Round action cells */}
      {rounds.map((r) => {
        const a = c.actions[r];
        const acted = a?.acted ?? false;
        return (
          <td key={r} className="px-1 py-1.5 text-center">
            <button
              onClick={() => onEditAction(r)}
              title={a?.text || (acted ? "Acted" : "Record action")}
              className={`w-full min-h-[2rem] rounded-md border px-1 py-1 text-[11px] leading-tight transition ${
                acted
                  ? "bg-secondary/10 border-secondary/40 text-on-surface"
                  : r === currentRound
                    ? "border-primary/40 text-outline hover:bg-primary/5"
                    : "border-outline-variant/30 text-outline/60 hover:bg-surface-container-high"
              }`}
            >
              {a?.text ? (
                <span className="line-clamp-2">{a.text}</span>
              ) : acted ? (
                <Icon name="check" size={16} className="text-secondary" />
              ) : (
                <Icon name="add" size={14} className="opacity-40" />
              )}
            </button>
          </td>
        );
      })}

      {/* Row controls */}
      <td className="px-1 py-1.5">
        <div className="flex flex-col items-center gap-0.5">
          <button
            className="text-outline hover:text-primary disabled:opacity-30 transition"
            onClick={() => move(c.id, -1)}
            disabled={index === 0}
            aria-label="Move up"
          >
            <Icon name="keyboard_arrow_up" size={16} />
          </button>
          <button
            className="text-outline hover:text-primary disabled:opacity-30 transition"
            onClick={() => move(c.id, 1)}
            disabled={index === count - 1}
            aria-label="Move down"
          >
            <Icon name="keyboard_arrow_down" size={16} />
          </button>
          <button
            className="text-outline hover:text-error transition"
            onClick={() => remove(c.id)}
            aria-label={`Remove ${c.name}`}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
