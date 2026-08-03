import { useCharacter } from "@/store/character";
import { abilityMod, abilityScore } from "@/lib/abilities";
import { fmtBonus, weaponAttackBonus, weaponDamageLabel } from "@/lib/weapons";
import type { Ability, Weapon } from "@/types/character";
import BreakdownRow from "../ui/BreakdownRow";

const ABILITY_LABEL: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/**
 * Weapon attacks, mirroring the Armor Class panel.
 *
 * Numbers only: the app is a companion for play with physical dice, so it
 * reports the modifier and never rolls. The breakdown is there so a wrong total
 * is visible rather than merely wrong.
 */
export default function AttacksPanel() {
  // `weapons` is genuinely undefined for the sample wizard, for XML imports and
  // for every store persisted before the field existed.
  const weapons = useCharacter((s) => s.character.weapons) ?? [];
  if (weapons.length === 0) return null;

  return (
    <div className="bg-surface-container border border-outline-variant/30 rounded-xl p-md relative overflow-hidden">
      <div className="leather-noise absolute inset-0" />
      <div className="relative space-y-md">
        <h3 className="font-serif text-title-sm text-primary">Attacks</h3>
        {weapons.map((w, i) => (
          <WeaponBlock key={`${w.name}-${i}`} weapon={w} />
        ))}
      </div>
    </div>
  );
}

function WeaponBlock({ weapon }: { weapon: Weapon }) {
  const c = useCharacter((s) => s.character);
  const attack = weaponAttackBonus(c, weapon);
  const abilityBonus = abilityMod(abilityScore(c, weapon.ability));

  return (
    <div>
      {/* Two columns once there is room: identity on the left, arithmetic on the
          right. Stacked on narrow screens, and the breakdown is width-capped so
          its values never drift a whole column away from their labels. */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-md">
        <div className="flex items-center gap-md flex-1 min-w-0">
          <div className="shrink-0 w-20 h-20 rounded-full border-2 border-primary/60 flex flex-col items-center justify-center bg-surface-container-low">
            <span className="font-serif text-3xl text-primary leading-none">
              {fmtBonus(attack)}
            </span>
            <span className="label-caps text-outline text-[9px] mt-0.5">ATK</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-serif text-on-surface truncate">{weapon.name}</p>
            <p className="font-mono text-sm text-on-surface-variant">
              {weaponDamageLabel(c, weapon)}
            </p>
            {weapon.range && <p className="text-xs text-outline">{weapon.range}</p>}
            {weapon.properties && weapon.properties.length > 0 && (
              <p className="text-xs text-outline">{weapon.properties.join(" · ")}</p>
            )}
          </div>
        </div>

        <ul className="space-y-0.5 text-sm w-full sm:w-56 shrink-0">
          <BreakdownRow
            label={ABILITY_LABEL[weapon.ability]}
            value={abilityBonus}
            signed
          />
          {/* Shown even when it does not apply: a missing row is indistinguishable
              from a bug, and "why is my bonus low?" is exactly the question this
              panel exists to answer. */}
          <BreakdownRow
            label="Proficiency"
            value={weapon.proficient ? fmtBonus(c.proficiencyBonus) : "—"}
            hint={weapon.proficient ? undefined : "not proficient"}
          />
          {weapon.magicBonus ? (
            <BreakdownRow label="Magic bonus" value={weapon.magicBonus} signed />
          ) : null}
        </ul>
      </div>

      {weapon.note && (
        <p className="text-[11px] text-on-surface-variant italic mt-sm leading-snug">
          {weapon.note}
        </p>
      )}
    </div>
  );
}
