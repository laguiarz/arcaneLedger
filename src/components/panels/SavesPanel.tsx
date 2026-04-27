import { useCharacter, savingThrow, abilityMod, spellSaveDc, spellAttackBonus } from "@/store/character";
import type { Ability } from "@/types/character";
import { abilityShort } from "@/lib/constants";
import Icon from "../ui/Icon";

const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

function fmt(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

export default function SavesPanel() {
  const c = useCharacter((s) => s.character);
  const dc = spellSaveDc(c);
  const atk = spellAttackBonus(c);

  return (
    <div className="bg-surface-container border border-amber-900/30 rounded-xl p-md relative overflow-hidden">
      <div className="leather-noise absolute inset-0" />
      <div className="relative">
        <div className="flex items-baseline justify-between mb-sm">
          <h3 className="font-serif text-title-sm text-primary">Saving Throws</h3>
          <span className="text-xs text-outline">Prof +{c.proficiencyBonus}</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ABILITIES.map((ab) => {
            const proficient = c.savingThrowProficiencies.includes(ab);
            const score = c.abilities[ab];
            const save = savingThrow(c, ab);
            return (
              <div
                key={ab}
                className={`relative rounded-lg p-2 border text-center transition ${
                  proficient
                    ? "bg-primary/10 border-primary/40"
                    : "bg-surface-container-low border-outline-variant/40"
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="label-caps text-primary text-[10px]">{abilityShort(ab)}</span>
                  {proficient && (
                    <Icon name="star" filled size={10} className="text-primary -mt-0.5" />
                  )}
                </div>
                <div className={`font-serif text-2xl leading-tight ${proficient ? "text-primary" : "text-on-surface"}`}>
                  {fmt(save)}
                </div>
                <div className="text-[10px] text-outline">
                  {score} ({fmt(abilityMod(score))})
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-sm pt-sm border-t border-outline-variant/30">
          <Stat label="Spell Save DC" value={dc} />
          <Stat label="Spell Attack" value={fmt(atk)} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between bg-surface-container-low rounded-md px-sm py-2 border border-outline-variant/30">
      <span className="label-caps text-outline">{label}</span>
      <span className="font-serif text-primary text-lg">{value}</span>
    </div>
  );
}
