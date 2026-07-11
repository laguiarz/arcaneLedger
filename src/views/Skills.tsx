import { useState } from "react";
import { useCharacter } from "@/store/character";
import { abilityMod, skillModifier, passivePerception } from "@/lib/skills";
import { abilityScore } from "@/lib/abilities";
import { SKILLS_IN_ORDER, abilityLabel, abilityShort } from "@/lib/constants";
import { useSkillRoll } from "@/components/SkillRollModal";
import SectionHeader from "@/components/ui/SectionHeader";
import Icon from "@/components/ui/Icon";
import type { Ability, Character, SkillName } from "@/types/character";

function fmt(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

const ABILITY_ORDER: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

export default function Skills() {
  const c = useCharacter((s) => s.character);
  const { roll, modal } = useSkillRoll();

  // Group the canonical skill list by governing ability, preserving order.
  const groups = ABILITY_ORDER.map((ability) => ({
    ability,
    skills: SKILLS_IN_ORDER.filter((s) => s.ability === ability),
  })).filter((g) => g.skills.length > 0);

  return (
    <div className="max-w-3xl mx-auto p-md md:p-lg space-y-lg">
      <SectionHeader icon="checklist" title="Skills" subtitle={c.name} />

      <PassivePerceptionCard c={c} />

      <div className="space-y-md">
        {groups.map((g) => (
          <div key={g.ability}>
            <h3 className="label-caps text-outline mb-2 flex items-center gap-2">
              <span className="h-px flex-1 bg-outline-variant/40" />
              {abilityLabel(g.ability)}
              <span className="h-px flex-1 bg-outline-variant/40" />
            </h3>
            <div className="space-y-1">
              {g.skills.map((s) => (
                <SkillRow
                  key={s.name}
                  c={c}
                  skill={s.name}
                  ability={s.ability}
                  label={s.label}
                  onRoll={() => roll(s.name, s.label)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {modal}
    </div>
  );
}

function PassivePerceptionCard({ c }: { c: Character }) {
  return (
    <div className="bg-surface-container border border-amber-900/30 rounded-xl p-md relative overflow-hidden">
      <div className="leather-noise absolute inset-0" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-sm">
          <Icon name="visibility" filled className="text-primary text-2xl" />
          <div>
            <h3 className="font-serif text-title-sm text-primary leading-tight">Passive Perception</h3>
            <p className="text-xs text-outline">10 + Perception modifier</p>
          </div>
        </div>
        <div className="font-serif text-4xl text-primary leading-none">{passivePerception(c)}</div>
      </div>
    </div>
  );
}

function SkillRow({
  c,
  skill,
  ability,
  label,
  onRoll,
}: {
  c: Character;
  skill: SkillName;
  ability: Ability;
  label: string;
  onRoll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const prof = c.skills?.[skill];
  const proficient = !!(prof?.proficient || prof?.expertise);
  const expertise = !!prof?.expertise;
  const mod = skillModifier(c, skill);

  return (
    <div
      className={`rounded-lg border transition ${
        proficient
          ? "bg-primary/10 border-primary/40"
          : "bg-surface-container-low border-outline-variant/40"
      }`}
    >
      <div className="flex items-center">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex-1 min-w-0 flex items-center gap-3 pl-sm py-2.5 text-left"
        >
          <span className="shrink-0 w-5 flex justify-center">
            {expertise ? (
              <Icon name="grade" filled size={18} className="text-primary drop-shadow-[0_0_4px_rgba(233,193,118,0.5)]" />
            ) : proficient ? (
              <Icon name="star" filled size={16} className="text-primary" />
            ) : (
              <span className="w-2 h-2 rounded-full border border-outline-variant/60" />
            )}
          </span>

          <span className={`flex-1 min-w-0 font-serif text-base ${proficient ? "text-primary" : "text-on-surface"}`}>
            {label}
          </span>

          <span className="label-caps text-outline text-[10px] px-1.5 py-0.5 rounded border border-outline-variant/40">
            {abilityShort(ability)}
          </span>

          <span className={`font-serif text-xl w-10 text-right ${proficient ? "text-primary" : "text-on-surface"}`}>
            {fmt(mod)}
          </span>

          <Icon
            name={open ? "expand_less" : "expand_more"}
            size={18}
            className="text-outline shrink-0"
          />
        </button>

        <button
          onClick={onRoll}
          aria-label={`Roll ${label}`}
          title={`Roll ${label}`}
          className="shrink-0 px-sm py-2.5 text-outline hover:text-primary transition active:scale-90"
        >
          <Icon name="casino" size={20} />
        </button>
      </div>

      {open && (
        <div className="px-sm pb-2.5 -mt-0.5 text-sm text-on-surface-variant">
          <Breakdown c={c} skill={skill} ability={ability} />
        </div>
      )}
    </div>
  );
}

function Breakdown({
  c,
  skill,
  ability,
}: {
  c: Character;
  skill: SkillName;
  ability: Ability;
}) {
  const prof = c.skills?.[skill];
  const proficient = !!(prof?.proficient || prof?.expertise);
  const expertise = !!prof?.expertise;
  const base = abilityMod(abilityScore(c, ability));
  const pb = c.proficiencyBonus;

  const parts: string[] = [`ability mod (${fmt(base)})`];
  if (proficient) parts.push(`proficiency (${fmt(pb)})`);
  if (expertise) parts.push(`expertise (${fmt(pb)})`);

  return (
    <span className="font-mono text-xs">
      {parts.join(" + ")} = <span className="text-primary font-bold">{fmt(skillModifier(c, skill))}</span>
    </span>
  );
}
