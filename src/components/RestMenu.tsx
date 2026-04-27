import { useEffect, useState } from "react";
import { useCharacter, arcaneRecoveryBudget, abilityMod } from "@/store/character";
import type { SpellLevel } from "@/types/character";
import Icon from "./ui/Icon";
import Modal from "./ui/Modal";
import { levelLabel, SPELL_LEVELS } from "@/lib/constants";

interface Props {
  open: boolean;
  onClose: () => void;
}

type View = "menu" | "short" | "recovery";

export default function RestMenu({ open, onClose }: Props) {
  const c = useCharacter((s) => s.character);
  const longRest = useCharacter((s) => s.longRest);
  const shortRest = useCharacter((s) => s.shortRest);
  const spendHitDie = useCharacter((s) => s.spendHitDie);
  const arcaneRecovery = useCharacter((s) => s.arcaneRecovery);

  const [view, setView] = useState<View>("menu");
  const [pick, setPick] = useState<Partial<Record<SpellLevel, number>>>({});
  const [roll, setRoll] = useState<string>("");

  // Reset to the menu whenever the parent reopens the modal.
  useEffect(() => {
    if (open) {
      setView("menu");
      setPick({});
      setRoll("");
    }
  }, [open]);

  const recoveryRes = c.resources.find((r) => r.name === "Arcane Recovery");
  const recoveryAvailable = !!recoveryRes && recoveryRes.used < recoveryRes.max;
  const wizardLevel = c.className.toLowerCase() === "wizard" ? c.level : 0;
  const budget = arcaneRecoveryBudget(wizardLevel);

  const totalCost = SPELL_LEVELS.reduce((sum, lvl) => sum + (pick[lvl] ?? 0) * lvl, 0);
  const overBudget = totalCost > budget;

  const conMod = abilityMod(c.abilities.con);
  const hdRemaining = c.hitDice.max - c.hitDice.spent;
  const shortRestResources = c.resources.filter((r) => r.recharge === "short" && r.used > 0);

  const close = () => {
    onClose();
    setView("menu");
    setPick({});
    setRoll("");
  };

  const handleSpendHd = () => {
    const n = parseInt(roll, 10);
    if (!Number.isFinite(n) || n < 1) return;
    spendHitDie(n);
    setRoll("");
  };

  return (
    <>
      <Modal open={open && view === "menu"} onClose={close} title="Take a Rest" width="max-w-md">
        <div className="space-y-md">
          <button
            className="w-full text-left p-md bg-surface-container-high rounded-lg border border-outline-variant/40 hover:border-primary/50 hover:bg-surface-container-highest transition group"
            onClick={() => {
              longRest();
              close();
            }}
          >
            <div className="flex items-start gap-sm">
              <Icon name="bedtime" filled className="text-primary text-2xl" />
              <div className="flex-1">
                <h4 className="font-serif text-title-sm text-primary group-hover:text-primary-fixed">
                  Long Rest
                </h4>
                <p className="text-sm text-on-surface-variant">
                  Restore HP & spell slots, recover {Math.max(1, Math.ceil(c.hitDice.max / 2))} Hit Dice,
                  reset daily resources, reduce exhaustion by 1.
                </p>
              </div>
            </div>
          </button>

          <button
            className="w-full text-left p-md bg-surface-container-high rounded-lg border border-outline-variant/40 hover:border-primary/50 hover:bg-surface-container-highest transition group"
            onClick={() => setView("short")}
          >
            <div className="flex items-start gap-sm">
              <Icon name="hourglass_empty" className="text-primary text-2xl" />
              <div className="flex-1">
                <h4 className="font-serif text-title-sm text-primary group-hover:text-primary-fixed">
                  Short Rest
                </h4>
                <p className="text-sm text-on-surface-variant">
                  Spend Hit Dice to heal, recharge short-rest features
                  {wizardLevel > 0 ? ", optionally use Arcane Recovery" : ""}.
                </p>
              </div>
            </div>
          </button>
        </div>
      </Modal>

      <Modal
        open={open && view === "short"}
        onClose={close}
        title="Short Rest"
        width="max-w-md"
      >
        <div className="space-y-md">
          {/* Hit Dice spending */}
          <section className="bg-surface-container-low border border-outline-variant/40 rounded-lg p-sm">
            <div className="flex items-center justify-between mb-sm">
              <div className="flex items-center gap-2">
                <Icon name="casino" className="text-primary" />
                <h4 className="font-serif text-title-sm text-primary">Hit Dice</h4>
              </div>
              <span className="text-sm text-on-surface-variant">
                <span className="text-primary font-bold">{hdRemaining}</span>
                <span className="text-outline">/{c.hitDice.max}</span>
                <span className="text-outline ml-1">d{c.hitDice.die}</span>
              </span>
            </div>

            {hdRemaining === 0 ? (
              <p className="text-xs text-outline italic">No Hit Dice remaining. Rest fully on a long rest.</p>
            ) : (
              <>
                <p className="text-xs text-on-surface-variant mb-sm">
                  Roll 1d{c.hitDice.die} and enter the result. Heal = roll
                  {conMod >= 0 ? ` + ${conMod}` : ` − ${Math.abs(conMod)}`} (CON), min 1.
                  Healed: <span className="text-secondary font-bold">{c.hp.current}</span>/
                  <span className="text-outline">{c.hp.max}</span> HP.
                </p>
                <div className="flex items-center gap-sm">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={`d${c.hitDice.die}`}
                    min={1}
                    max={c.hitDice.die}
                    value={roll}
                    onChange={(e) => setRoll(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSpendHd();
                    }}
                    className="input-inset w-20 text-center font-mono"
                    autoFocus
                  />
                  <button
                    className="btn-brass flex-1"
                    onClick={handleSpendHd}
                    disabled={!roll || c.hp.current >= c.hp.max}
                    title={c.hp.current >= c.hp.max ? "Already at full HP" : undefined}
                  >
                    <Icon name="healing" /> Spend & Heal
                    {roll && Number(roll) > 0 && (
                      <span className="ml-1 text-on-primary/80">
                        +{Math.max(1, Number(roll) + conMod)}
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Resources that will recharge */}
          <section className="bg-surface-container-low border border-outline-variant/40 rounded-lg p-sm">
            <div className="flex items-center gap-2 mb-sm">
              <Icon name="autorenew" className="text-primary" />
              <h4 className="font-serif text-title-sm text-primary">On Complete</h4>
            </div>
            {shortRestResources.length === 0 ? (
              <p className="text-xs text-outline italic">
                No short-rest features need recharging.
              </p>
            ) : (
              <ul className="text-sm text-on-surface-variant space-y-1">
                {shortRestResources.map((r) => (
                  <li key={r.name} className="flex items-center justify-between">
                    <span>{r.name}</span>
                    <span className="text-outline text-xs">
                      {r.max - r.used}/{r.max} → {r.max}/{r.max}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Arcane Recovery (Wizard only) */}
          {wizardLevel > 0 && (
            <button
              disabled={!recoveryAvailable}
              className={`w-full text-left p-sm rounded-lg border transition group ${
                recoveryAvailable
                  ? "bg-secondary-container/30 border-secondary/40 hover:border-secondary hover:bg-secondary-container/50"
                  : "bg-surface-container-low border-outline-variant/30 opacity-60 cursor-not-allowed"
              }`}
              onClick={() => recoveryAvailable && setView("recovery")}
            >
              <div className="flex items-start gap-sm">
                <Icon name="auto_awesome" filled className="text-secondary text-xl" />
                <div className="flex-1">
                  <h4 className="font-serif text-secondary">Arcane Recovery</h4>
                  <p className="text-xs text-on-surface-variant">
                    {recoveryAvailable
                      ? `Recover up to ${budget} levels of slots (none above 5).`
                      : "Already used since last long rest."}
                  </p>
                </div>
              </div>
            </button>
          )}

          {/* Footer */}
          <div className="flex gap-sm justify-end pt-sm border-t border-outline-variant/30">
            <button className="btn-ghost" onClick={() => setView("menu")}>
              Back
            </button>
            <button
              className="btn-brass"
              onClick={() => {
                shortRest();
                close();
              }}
            >
              <Icon name="check" /> Complete Short Rest
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={open && view === "recovery"}
        onClose={() => setView("short")}
        title="Arcane Recovery"
        width="max-w-md"
      >
        <p className="text-sm text-on-surface-variant mb-sm">
          Recover spell slots whose combined level total is at most{" "}
          <span className="text-primary font-bold">{budget}</span>. None above level 5.
        </p>

        <div className="space-y-2 mb-md">
          {SPELL_LEVELS.filter((lvl) => lvl <= 5 && (c.spellSlotsMax[lvl] ?? 0) > 0).map((lvl) => {
            const cur = c.spellSlots[lvl] ?? 0;
            const max = c.spellSlotsMax[lvl] ?? 0;
            const missing = max - cur;
            const picked = pick[lvl] ?? 0;
            return (
              <div
                key={lvl}
                className="flex items-center justify-between p-sm bg-surface-container-low rounded-md border border-outline-variant/40"
              >
                <div>
                  <span className="font-serif text-primary">Level {levelLabel(lvl)}</span>
                  <span className="ml-sm text-xs text-outline">
                    {cur}/{max} available
                  </span>
                </div>
                <div className="inline-flex items-center gap-1">
                  <button
                    className="btn-icon"
                    disabled={picked <= 0}
                    onClick={() => setPick((p) => ({ ...p, [lvl]: Math.max(0, (p[lvl] ?? 0) - 1) }))}
                  >
                    <Icon name="remove" />
                  </button>
                  <span className="font-mono w-6 text-center">{picked}</span>
                  <button
                    className="btn-icon"
                    disabled={picked >= missing}
                    onClick={() =>
                      setPick((p) => ({ ...p, [lvl]: Math.min(missing, (p[lvl] ?? 0) + 1) }))
                    }
                  >
                    <Icon name="add" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between mb-sm text-sm">
          <span className="text-on-surface-variant">Total cost</span>
          <span className={`font-mono font-bold ${overBudget ? "text-error" : "text-primary"}`}>
            {totalCost} / {budget}
          </span>
        </div>

        <div className="flex gap-sm justify-end">
          <button className="btn-ghost" onClick={() => setView("short")}>
            Cancel
          </button>
          <button
            className="btn-brass"
            disabled={overBudget || totalCost === 0}
            onClick={() => {
              arcaneRecovery(pick);
              setPick({});
              setView("short");
            }}
          >
            Recover
          </button>
        </div>
      </Modal>
    </>
  );
}
