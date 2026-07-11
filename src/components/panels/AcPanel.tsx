import { useState } from "react";
import { useCharacter } from "@/store/character";
import { abilityMod, abilityScore } from "@/lib/abilities";
import { armorClass, dexAcContribution, DEX_MODE_LABEL } from "@/lib/armor";
import type { DexToAc } from "@/types/character";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import Stepper from "../ui/Stepper";

function fmt(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

export default function AcPanel() {
  const c = useCharacter((s) => s.character);
  const setArmor = useCharacter((s) => s.setArmor);
  const [editing, setEditing] = useState(false);

  const ac = armorClass(c);
  const armor = c.armor;
  const dexMod = abilityMod(abilityScore(c, "dex"));

  return (
    <div className="bg-surface-container border border-amber-900/30 rounded-xl p-md relative overflow-hidden">
      <div className="leather-noise absolute inset-0" />
      <div className="relative">
        <div className="flex items-baseline justify-between mb-sm">
          <h3 className="font-serif text-title-sm text-primary">Armor Class</h3>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-outline hover:text-primary flex items-center gap-1"
          >
            <Icon name="edit" size={14} /> Edit
          </button>
        </div>

        <div className="flex items-center gap-md">
          <div className="shrink-0 w-20 h-20 rounded-full border-2 border-primary/60 flex flex-col items-center justify-center bg-surface-container-low">
            <span className="font-serif text-3xl text-primary leading-none">{ac}</span>
            <span className="label-caps text-outline text-[9px] mt-0.5">AC</span>
          </div>

          <div className="flex-1 min-w-0">
            {armor ? (
              <ul className="space-y-0.5 text-sm">
                <BreakdownRow label="Armor base" value={armor.base} />
                <BreakdownRow
                  label={DEX_MODE_LABEL[armor.dexMode]}
                  value={dexAcContribution(armor.dexMode, dexMod)}
                  hint={`Dex ${fmt(dexMod)}`}
                  signed
                />
                {armor.shield && <BreakdownRow label="Shield" value={2} signed />}
                {armor.miscBonus !== 0 && (
                  <BreakdownRow label="Other" value={armor.miscBonus} signed />
                )}
              </ul>
            ) : (
              <div className="text-sm text-on-surface-variant">
                <p className="mb-2">Flat value — doesn't track Dexterity yet.</p>
                <button onClick={() => setArmor({})} className="btn-brass text-sm">
                  <Icon name="calculate" filled /> Track Dexterity
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && <AcEditModal onClose={() => setEditing(false)} />}
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  hint,
  signed,
}: {
  label: string;
  value: number;
  hint?: string;
  signed?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-on-surface-variant truncate">
        {label}
        {hint && <span className="text-outline text-xs"> · {hint}</span>}
      </span>
      <span className="font-mono text-on-surface shrink-0">
        {signed ? fmt(value) : value}
      </span>
    </li>
  );
}

const DEX_MODES: DexToAc[] = ["full", "max2", "none"];

function AcEditModal({ onClose }: { onClose: () => void }) {
  const c = useCharacter((s) => s.character);
  const setArmor = useCharacter((s) => s.setArmor);

  // Reading the computed AC keeps the preview live as fields change.
  const ac = armorClass(c);
  const armor = c.armor;

  return (
    <Modal open onClose={onClose} title="Armor Class" width="max-w-sm">
      <div className="space-y-sm">
        <Row label="Armor base" hint="10 unarmored · 11 leather · 14 chain shirt · 18 plate">
          <Stepper
            value={armor?.base ?? 10}
            min={1}
            max={30}
            onChange={(base) => setArmor({ base })}
            ariaLabel="Armor base"
          />
        </Row>

        <div>
          <div className="text-sm text-on-surface mb-1">Dexterity to AC</div>
          <div className="flex gap-1">
            {DEX_MODES.map((m) => {
              const active = (armor?.dexMode ?? "full") === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setArmor({ dexMode: m })}
                  className={`flex-1 py-1.5 rounded-md text-xs font-bold transition border ${
                    active
                      ? "bg-primary/15 text-primary border-primary/40"
                      : "text-outline border-transparent hover:bg-surface-container-low"
                  }`}
                >
                  {DEX_MODE_LABEL[m]}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center justify-between gap-2 cursor-pointer">
          <span className="text-sm text-on-surface">Shield (+2)</span>
          <input
            type="checkbox"
            checked={armor?.shield ?? false}
            onChange={(e) => setArmor({ shield: e.target.checked })}
            className="w-5 h-5 accent-primary"
            aria-label="Shield"
          />
        </label>

        <Row label="Other bonus" hint="Rings/cloaks, magic armor, fighting style…">
          <Stepper
            value={armor?.miscBonus ?? 0}
            min={-10}
            max={20}
            onChange={(miscBonus) => setArmor({ miscBonus })}
            ariaLabel="Other bonus"
          />
        </Row>

        <div className="flex items-center justify-between pt-sm mt-sm border-t border-outline-variant/30">
          <span className="label-caps text-outline">Armor Class</span>
          <span className="font-serif text-primary text-2xl">{ac}</span>
        </div>
      </div>
    </Modal>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-sm text-on-surface">{label}</div>
        <div className="text-[10px] text-outline">{hint}</div>
      </div>
      {children}
    </div>
  );
}
