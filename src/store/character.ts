import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Ability,
  Character,
  ConditionId,
  Resource,
  Spell,
  SpellLevel,
} from "@/types/character";
import { sampleWizard } from "@/data/sampleWizard";

interface CharacterState {
  character: Character;
  /**
   * Identifies where the active character came from. `null` means the user has
   * never picked from the library or imported anything in this profile — used
   * to trigger the first-run picker. `"sample"` = sample wizard fallback.
   * `"custom"` = imported via Settings (JSON/XML, no library origin).
   * Otherwise = `id` from the library manifest.
   */
  activeCharacterId: string | null;

  // HP
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  setTempHp: (amount: number) => void;
  setMaxHp: (max: number) => void;

  // Hit Dice
  /**
   * Spend one Hit Die. `roll` is the value rolled on the HD; healing applied is
   * max(1, roll + CON modifier), capped at HP max. No-op if no HD remain.
   */
  spendHitDie: (roll: number) => void;

  // Spells
  castSpell: (slotLevel: SpellLevel, opts?: { concentration?: { spellName: string } }) => void;
  /** Cast an innate spell using its free 1/long-rest charge (no slot spent). */
  castSpellFree: (spellName: string, opts?: { concentration?: { level: SpellLevel } }) => void;
  refundSlot: (slotLevel: SpellLevel) => void;
  togglePrepared: (spellName: string) => void;

  // Concentration
  setConcentration: (spellName: string, level: SpellLevel) => void;
  dropConcentration: () => void;
  bumpConcentrationRounds: (delta?: number) => void;

  // Resources
  useResource: (resourceName: string, count?: number) => void;
  refundResource: (resourceName: string, count?: number) => void;
  setResource: (resourceName: string, used: number) => void;

  // Conditions
  toggleCondition: (id: ConditionId) => void;
  setExhaustion: (level: number) => void;

  // Party (names of fellow party members, persisted on the sheet)
  setParty: (names: string[]) => void;

  // Rests
  longRest: () => void;
  shortRest: () => void;
  arcaneRecovery: (slotsByLevel: Partial<Record<SpellLevel, number>>) => void;

  // Persistence
  loadCharacter: (
    c: Character,
    opts?: { sourceId?: string | null },
  ) => void;
  resetToSample: () => void;
  exportJson: () => string;
}

const SPELL_LEVELS: SpellLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const useCharacter = create<CharacterState>()(
  persist(
    (set, get) => ({
      character: sampleWizard,
      activeCharacterId: null,

      takeDamage: (amount) =>
        set((s) => {
          const c = { ...s.character, hp: { ...s.character.hp } };
          let remaining = Math.max(0, amount);
          if (c.hp.temp > 0) {
            const absorbed = Math.min(c.hp.temp, remaining);
            c.hp.temp -= absorbed;
            remaining -= absorbed;
          }
          c.hp.current = Math.max(0, c.hp.current - remaining);
          return { character: c };
        }),

      heal: (amount) =>
        set((s) => ({
          character: {
            ...s.character,
            hp: {
              ...s.character.hp,
              current: Math.min(s.character.hp.max, s.character.hp.current + Math.max(0, amount)),
            },
          },
        })),

      setTempHp: (amount) =>
        set((s) => ({
          character: { ...s.character, hp: { ...s.character.hp, temp: Math.max(0, amount) } },
        })),

      setMaxHp: (max) =>
        set((s) => {
          const newMax = Math.max(1, max);
          return {
            character: {
              ...s.character,
              hp: {
                max: newMax,
                temp: s.character.hp.temp,
                current: Math.min(newMax, s.character.hp.current),
              },
            },
          };
        }),

      spendHitDie: (roll) =>
        set((s) => {
          const c = s.character;
          const remaining = c.hitDice.max - c.hitDice.spent;
          if (remaining <= 0) return {};
          const conMod = abilityMod(c.abilities.con);
          const healed = Math.max(1, roll + conMod);
          return {
            character: {
              ...c,
              hp: {
                ...c.hp,
                current: Math.min(c.hp.max, c.hp.current + healed),
              },
              hitDice: { ...c.hitDice, spent: c.hitDice.spent + 1 },
            },
          };
        }),

      castSpell: (slotLevel, opts) =>
        set((s) => {
          const cur = s.character.spellSlots[slotLevel] ?? 0;
          if (cur <= 0) return {};
          const next = {
            ...s.character,
            spellSlots: { ...s.character.spellSlots, [slotLevel]: cur - 1 },
          };
          if (opts?.concentration) {
            next.concentration = {
              spellName: opts.concentration.spellName,
              level: slotLevel,
              rounds: 0,
            };
          }
          return { character: next };
        }),

      castSpellFree: (spellName, opts) =>
        set((s) => {
          const spell = s.character.innateSpells.find((sp) => sp.name === spellName);
          if (!spell) return {};
          const max = spell.freeCastsPerLongRest ?? 0;
          const used = s.character.racialFreeCastsUsed[spellName] ?? 0;
          if (used >= max) return {};
          const next: Character = {
            ...s.character,
            racialFreeCastsUsed: {
              ...s.character.racialFreeCastsUsed,
              [spellName]: used + 1,
            },
          };
          if (opts?.concentration) {
            next.concentration = {
              spellName,
              level: opts.concentration.level,
              rounds: 0,
            };
          }
          return { character: next };
        }),

      setConcentration: (spellName, level) =>
        set((s) => ({
          character: { ...s.character, concentration: { spellName, level, rounds: 0 } },
        })),

      dropConcentration: () =>
        set((s) => ({ character: { ...s.character, concentration: null } })),

      bumpConcentrationRounds: (delta = 1) =>
        set((s) => {
          if (!s.character.concentration) return {};
          return {
            character: {
              ...s.character,
              concentration: {
                ...s.character.concentration,
                rounds: Math.max(0, s.character.concentration.rounds + delta),
              },
            },
          };
        }),

      refundSlot: (slotLevel) =>
        set((s) => {
          const cur = s.character.spellSlots[slotLevel] ?? 0;
          const max = s.character.spellSlotsMax[slotLevel] ?? 0;
          return {
            character: {
              ...s.character,
              spellSlots: { ...s.character.spellSlots, [slotLevel]: Math.min(max, cur + 1) },
            },
          };
        }),

      togglePrepared: (spellName) =>
        set((s) => {
          const has = s.character.preparedSpells.includes(spellName);
          return {
            character: {
              ...s.character,
              preparedSpells: has
                ? s.character.preparedSpells.filter((n) => n !== spellName)
                : [...s.character.preparedSpells, spellName],
            },
          };
        }),

      useResource: (resourceName, count = 1) =>
        set((s) => ({
          character: {
            ...s.character,
            resources: s.character.resources.map((r) =>
              r.name === resourceName
                ? { ...r, used: Math.min(r.max, r.used + count) }
                : r,
            ),
          },
        })),

      refundResource: (resourceName, count = 1) =>
        set((s) => ({
          character: {
            ...s.character,
            resources: s.character.resources.map((r) =>
              r.name === resourceName ? { ...r, used: Math.max(0, r.used - count) } : r,
            ),
          },
        })),

      setResource: (resourceName, used) =>
        set((s) => ({
          character: {
            ...s.character,
            resources: s.character.resources.map((r) =>
              r.name === resourceName ? { ...r, used: Math.max(0, Math.min(r.max, used)) } : r,
            ),
          },
        })),

      toggleCondition: (id) =>
        set((s) => {
          const has = s.character.conditions.active.includes(id);
          return {
            character: {
              ...s.character,
              conditions: {
                ...s.character.conditions,
                active: has
                  ? s.character.conditions.active.filter((c) => c !== id)
                  : [...s.character.conditions.active, id],
              },
            },
          };
        }),

      setExhaustion: (level) =>
        set((s) => ({
          character: {
            ...s.character,
            conditions: {
              ...s.character.conditions,
              exhaustion: Math.max(0, Math.min(6, level)),
            },
          },
        })),

      setParty: (names) =>
        set((s) => ({
          character: {
            ...s.character,
            party: names.map((n) => n.trim()).filter(Boolean),
          },
        })),

      longRest: () =>
        set((s) => {
          const c = s.character;
          const restoredSlots: typeof c.spellSlots = { ...c.spellSlotsMax };
          const restoredResources: Resource[] = c.resources.map((r) =>
            r.recharge === "long" || r.recharge === "short" || r.recharge === "dawn"
              ? { ...r, used: 0 }
              : r,
          );
          // 2024 PHB: regain spent HD up to ceil(level/2), minimum 1.
          const hdRegain = Math.max(1, Math.ceil(c.hitDice.max / 2));
          return {
            character: {
              ...c,
              hp: { ...c.hp, current: c.hp.max, temp: 0 },
              hitDice: {
                ...c.hitDice,
                spent: Math.max(0, c.hitDice.spent - hdRegain),
              },
              spellSlots: restoredSlots,
              resources: restoredResources,
              racialFreeCastsUsed: {},
              concentration: null,
              conditions: {
                ...c.conditions,
                exhaustion: Math.max(0, c.conditions.exhaustion - 1),
              },
            },
          };
        }),

      shortRest: () =>
        set((s) => ({
          character: {
            ...s.character,
            resources: s.character.resources.map((r) =>
              r.recharge === "short" ? { ...r, used: 0 } : r,
            ),
          },
        })),

      arcaneRecovery: (slotsByLevel) =>
        set((s) => {
          const next = { ...s.character.spellSlots };
          for (const lvl of SPELL_LEVELS) {
            const ask = slotsByLevel[lvl] ?? 0;
            if (ask <= 0) continue;
            const max = s.character.spellSlotsMax[lvl] ?? 0;
            const cur = next[lvl] ?? 0;
            next[lvl] = Math.min(max, cur + ask);
          }
          return {
            character: {
              ...s.character,
              spellSlots: next,
              resources: s.character.resources.map((r) =>
                r.name === "Arcane Recovery"
                  ? { ...r, used: Math.min(r.max, r.used + 1) }
                  : r,
              ),
            },
          };
        }),

      loadCharacter: (c, opts) =>
        set({
          character: {
            ...c,
            // Tolerate older saves / hand-edited JSON missing the new fields.
            innateSpells: c.innateSpells ?? [],
            racialFreeCastsUsed: c.racialFreeCastsUsed ?? {},
            hitDice: c.hitDice ?? { die: 8, max: c.level, spent: 0 },
          },
          // Default to "custom" when the caller didn't tell us where the
          // character came from (e.g. Settings file import).
          activeCharacterId:
            opts && "sourceId" in opts ? opts.sourceId ?? null : "custom",
        }),
      resetToSample: () =>
        set({ character: sampleWizard, activeCharacterId: "sample" }),
      exportJson: () => JSON.stringify(get().character, null, 2),
    }),
    {
      name: "arcanist-ledger:character",
      // v4: added activeCharacterId for the cloud character library.
      // Old saves are dropped so users see the first-run picker.
      version: 4,
    },
  ),
);

// Selectors / helpers
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function savingThrow(c: Character, ability: Ability): number {
  const mod = abilityMod(c.abilities[ability]);
  const prof = c.savingThrowProficiencies.includes(ability) ? c.proficiencyBonus : 0;
  return mod + prof;
}

export function spellSaveDc(c: Character): number {
  if (c.spellSaveDcOverride != null) return c.spellSaveDcOverride;
  const ab = c.spellcastingAbility ?? "int";
  return 8 + c.proficiencyBonus + abilityMod(c.abilities[ab]);
}

export function spellAttackBonus(c: Character): number {
  if (c.spellAttackBonusOverride != null) return c.spellAttackBonusOverride;
  const ab = c.spellcastingAbility ?? "int";
  return c.proficiencyBonus + abilityMod(c.abilities[ab]);
}

export function arcaneRecoveryBudget(level: number): number {
  return Math.ceil(level / 2);
}

export function findSpell(c: Character, name: string): Spell | undefined {
  return (
    c.spellbook.find((s) => s.name === name) ??
    c.innateSpells.find((s) => s.name === name)
  );
}

export function freeCastsRemaining(c: Character, spellName: string): number {
  const spell = c.innateSpells.find((s) => s.name === spellName);
  if (!spell?.freeCastsPerLongRest) return 0;
  const used = c.racialFreeCastsUsed[spellName] ?? 0;
  return Math.max(0, spell.freeCastsPerLongRest - used);
}

export function preparedRituals(c: Character): Spell[] {
  return c.spellbook.filter((s) => s.ritual && c.preparedSpells.includes(s.name));
}

export function unpreparedRituals(c: Character): Spell[] {
  return c.spellbook.filter((s) => s.ritual && !c.preparedSpells.includes(s.name));
}

export function preparedNonRituals(c: Character): Spell[] {
  return c.spellbook
    .filter((s) => c.preparedSpells.includes(s.name))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

/**
 * Rituals the character can actually cast as rituals. Wizards (Ritual Adept)
 * cast any ritual in their spellbook even unprepared; every other class can
 * only ritual-cast spells it has prepared (2024 rules).
 */
export function availableRituals(c: Character): Spell[] {
  const rituals = c.spellbook.filter((s) => s.ritual);
  if (c.className.trim().toLowerCase() === "wizard") return rituals;
  return rituals.filter((s) => c.preparedSpells.includes(s.name));
}
