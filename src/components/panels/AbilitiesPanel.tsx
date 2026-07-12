import { useState } from "react";
import { useCharacter } from "@/store/character";
import { abilityMod, effectiveScore, ABILITY_KEYS } from "@/lib/abilities";
import type { Ability } from "@/types/character";
import { abilityShort, abilityLabel } from "@/lib/constants";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import Stepper from "../ui/Stepper";

function fmt(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

export default function AbilitiesPanel() {
  const c = useCharacter((s) => s.character);
  const [editing, setEditing] = useState<Ability | null>(null);

  return (
    <div className="bg-surface-container border border-outline-variant/30 rounded-xl p-md relative overflow-hidden">
      <div className="leather-noise absolute inset-0" />
      <div className="relative">
        <div className="flex items-baseline justify-between mb-sm">
          <h3 className="font-serif text-title-sm text-primary">Ability Scores</h3>
          <span className="text-xs text-outline">Tap to edit · base + feat + magic</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ABILITY_KEYS.map((ab) => {
            const b = c.abilities[ab];
            const total = effectiveScore(b);
            const hasMagic = b.magicBonus !== 0;
            const hasFeat = b.featBonus !== 0;
            return (
              <button
                key={ab}
                type="button"
                onClick={() => setEditing(ab)}
                aria-label={`Edit ${abilityLabel(ab)}`}
                className="relative rounded-lg p-2 border text-center transition bg-surface-container-low border-outline-variant/40 hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="label-caps text-primary text-[10px]">{abilityShort(ab)}</div>
                {/* Modifier — the number used at the table, biggest. */}
                <div className="font-serif text-2xl leading-tight text-on-surface">{fmt(abilityMod(total))}</div>
                {/* Ability score — secondary weight, but clearly present. */}
                <div className="font-serif text-base leading-tight text-on-surface-variant">{total}</div>
                {/* Breakdown — only when a bonus actually splits it (else it just
                    repeats the score). Smallest, dimmest. */}
                {(hasFeat || hasMagic) && (
                  <div className="mt-0.5 flex items-center justify-center gap-1 text-[9px] leading-none text-outline">
                    <span title="Base die value">{b.base}</span>
                    {hasFeat && (
                      <span className="text-secondary" title="Class/background/feat bonus">
                        {fmt(b.featBonus)}
                      </span>
                    )}
                    {hasMagic && (
                      <span className="text-primary" title="Magic bonus — removed in an antimagic field">
                        ✦{fmt(b.magicBonus)}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-sm text-[10px] text-outline flex items-center gap-1">
          <Icon name="auto_awesome" filled size={12} className="text-primary" />
          Amber = magic bonus; it's what an antimagic field strips.
        </p>
      </div>

      {editing && (
        <AbilityEditModal ability={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function AbilityEditModal({ ability, onClose }: { ability: Ability; onClose: () => void }) {
  const b = useCharacter((s) => s.character.abilities[ability]);
  const setAbilityBreakdown = useCharacter((s) => s.setAbilityBreakdown);
  const total = effectiveScore(b);

  return (
    <Modal open onClose={onClose} title={abilityLabel(ability)} width="max-w-sm">
      <div className="space-y-sm">
        <EditRow
          label="Base (die value)"
          hint="Original roll / point-buy / array"
          value={b.base}
          min={1}
          max={30}
          onChange={(base) => setAbilityBreakdown(ability, { base })}
        />
        <EditRow
          label="Class / background / feat"
          hint="Non-magical — kept in antimagic"
          value={b.featBonus}
          min={-10}
          max={20}
          onChange={(featBonus) => setAbilityBreakdown(ability, { featBonus })}
        />
        <EditRow
          label="Magic bonus"
          hint="From items — stripped in antimagic"
          value={b.magicBonus}
          min={-10}
          max={20}
          onChange={(magicBonus) => setAbilityBreakdown(ability, { magicBonus })}
        />

        <div className="flex items-center justify-between pt-sm mt-sm border-t border-outline-variant/30">
          <span className="label-caps text-outline">Effective</span>
          <span className="font-serif text-primary text-xl">
            {total} ({total - 10 >= 0 ? "+" : ""}
            {Math.floor((total - 10) / 2)})
          </span>
        </div>
      </div>
    </Modal>
  );
}

function EditRow({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-sm text-on-surface">{label}</div>
        <div className="text-[10px] text-outline">{hint}</div>
      </div>
      <Stepper value={value} min={min} max={max} onChange={onChange} ariaLabel={label} />
    </div>
  );
}
