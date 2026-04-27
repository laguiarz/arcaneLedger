import type { ConditionId, SpellLevel, SpellSchool } from "@/types/character";

export const CONDITIONS: { id: ConditionId; label: string; icon: string; desc: string }[] = [
  { id: "blinded", label: "Blinded", icon: "visibility_off", desc: "Auto-fail sight checks. Disadvantage on attacks; advantage against." },
  { id: "charmed", label: "Charmed", icon: "favorite", desc: "Can't attack charmer or target with harmful effects. Charmer has advantage on social checks." },
  { id: "deafened", label: "Deafened", icon: "hearing_disabled", desc: "Can't hear; auto-fail hearing checks." },
  { id: "frightened", label: "Frightened", icon: "sentiment_very_dissatisfied", desc: "Disadvantage on checks/attacks while source in sight. Can't move closer." },
  { id: "grappled", label: "Grappled", icon: "back_hand", desc: "Speed 0, no benefit from speed bonuses." },
  { id: "incapacitated", label: "Incapacitated", icon: "do_not_disturb_on", desc: "Can't take actions or reactions." },
  { id: "invisible", label: "Invisible", icon: "visibility_off", desc: "Heavily obscured. Advantage on attacks; attackers have disadvantage." },
  { id: "paralyzed", label: "Paralyzed", icon: "accessibility_new", desc: "Incapacitated, can't move/speak. Auto-fail Str/Dex saves. Crit if attacker within 5 ft." },
  { id: "petrified", label: "Petrified", icon: "diamond", desc: "Transformed to stone. Incapacitated, weight ×10, resistance to all damage." },
  { id: "poisoned", label: "Poisoned", icon: "science", desc: "Disadvantage on attacks and ability checks." },
  { id: "prone", label: "Prone", icon: "airline_seat_flat", desc: "Disadvantage on attacks. Attackers within 5 ft have advantage; else disadvantage." },
  { id: "restrained", label: "Restrained", icon: "lock", desc: "Speed 0. Disadvantage on attacks/Dex saves; attackers have advantage." },
  { id: "stunned", label: "Stunned", icon: "bolt", desc: "Incapacitated, can't move, speak only falteringly. Auto-fail Str/Dex saves. Attackers have advantage." },
  { id: "unconscious", label: "Unconscious", icon: "bedtime", desc: "Incapacitated, can't move/speak, unaware. Auto-fail Str/Dex. Attacks within 5 ft crit." },
];

export const SCHOOL_COLORS: Record<SpellSchool, { chip: string; accent: string }> = {
  Abjuration:    { chip: "bg-secondary-container text-on-secondary-container", accent: "from-secondary/40" },
  Conjuration:   { chip: "bg-tertiary-container text-on-tertiary-container",   accent: "from-tertiary/40" },
  Divination:    { chip: "bg-primary-container text-on-primary-container",     accent: "from-primary/30" },
  Enchantment:   { chip: "bg-tertiary-container text-on-tertiary-container",   accent: "from-tertiary/40" },
  Evocation:     { chip: "bg-error-container text-on-error-container",         accent: "from-error/40" },
  Illusion:      { chip: "bg-secondary-container text-on-secondary-container", accent: "from-secondary/40" },
  Necromancy:    { chip: "bg-surface-container-highest text-on-surface",       accent: "from-outline/40" },
  Transmutation: { chip: "bg-primary-container text-on-primary-container",     accent: "from-primary/30" },
};

export const SCHOOL_ICONS: Record<SpellSchool, string> = {
  Abjuration: "shield",
  Conjuration: "auto_awesome",
  Divination: "remove_red_eye",
  Enchantment: "favorite",
  Evocation: "local_fire_department",
  Illusion: "blur_on",
  Necromancy: "skull",
  Transmutation: "change_circle",
};

export const SPELL_LEVELS: SpellLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function levelLabel(lvl: SpellLevel): string {
  return ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][lvl - 1] ?? String(lvl);
}

export function abilityLabel(a: string): string {
  return ({ str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" } as Record<string, string>)[a] ?? a;
}

export function abilityShort(a: string): string {
  return a.toUpperCase();
}
