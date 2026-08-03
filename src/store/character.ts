import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Ability,
  AbilityBreakdown,
  ArmorConfig,
  Character,
  ConditionId,
  Resource,
  Spell,
  SpellLevel,
} from "@/types/character";
import { sampleWizard } from "@/data/sampleWizard";
import { abilityMod, abilityScore, normalizeAbilities } from "@/lib/abilities";
import { defaultArmorConfig } from "@/lib/armor";
import {
  clearLegacyGlobalPrompt,
  getLegacyGlobalPrompt,
} from "@/lib/combatNarration";

// Re-exported so existing `import { abilityMod } from "@/store/character"`
// call sites keep working now that the helpers live in @/lib/abilities.
export { abilityMod, abilityScore };

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

  /**
   * Revision of the library entry this character was loaded from. `null` when
   * the character did not come from the library, or came from a build that
   * predates revisions — in which case the app says "I don't know which version
   * this is" rather than claiming a newer one exists.
   */
  libraryRevision: string | null;

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

  // Abilities
  /** Patch one ability's breakdown (base / featBonus / magicBonus). */
  setAbilityBreakdown: (ability: Ability, parts: Partial<AbilityBreakdown>) => void;

  // Armor Class
  /**
   * Patch the AC formula. Seeds a config from the flat `ac` on first edit, so
   * calling this instantiates `armor` (and AC starts tracking Dexterity).
   */
  setArmor: (parts: Partial<ArmorConfig>) => void;

  // Conditions
  toggleCondition: (id: ConditionId) => void;
  setExhaustion: (level: number) => void;

  // Party (names of fellow party members, persisted on the sheet)
  setParty: (names: string[]) => void;

  // Narration prompt (per-character AI narration voice)
  setNarrationPrompt: (text: string) => void;
  /** One-time: adopt the pre-migration global narration prompt if unset. */
  adoptLegacyNarrationPrompt: () => void;

  // Rests
  longRest: () => void;
  shortRest: () => void;
  arcaneRecovery: (slotsByLevel: Partial<Record<SpellLevel, number>>) => void;

  // Persistence
  /**
   * `sourceId` is REQUIRED inside `opts` on purpose. The setter decides the
   * origin by key presence, so an optional one would let
   * `loadCharacter(c, { revision })` typecheck and silently mark a library
   * character as "custom".
   */
  loadCharacter: (
    c: Character,
    opts?: { sourceId: string | null; revision?: string | null },
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
      libraryRevision: null,

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
          const conMod = abilityMod(abilityScore(c, "con"));
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

      setAbilityBreakdown: (ability, parts) =>
        set((s) => ({
          character: {
            ...s.character,
            abilities: {
              ...s.character.abilities,
              [ability]: { ...s.character.abilities[ability], ...parts },
            },
          },
        })),

      setArmor: (parts) =>
        set((s) => {
          const cur = s.character.armor ?? defaultArmorConfig(s.character);
          return { character: { ...s.character, armor: { ...cur, ...parts } } };
        }),

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

      setNarrationPrompt: (text) =>
        set((s) => ({
          character: {
            ...s.character,
            // Empty string clears back to the default at read time.
            narrationPrompt: text.trim() ? text : undefined,
          },
        })),

      adoptLegacyNarrationPrompt: () =>
        set((s) => {
          if (s.character.narrationPrompt) return {};
          const legacy = getLegacyGlobalPrompt();
          if (!legacy) return {};
          clearLegacyGlobalPrompt();
          return { character: { ...s.character, narrationPrompt: legacy } };
        }),

      longRest: () =>
        set((s) => {
          const c = s.character;
          const restoredSlots: typeof c.spellSlots = { ...c.spellSlotsMax };
          const restoredResources: Resource[] = c.resources.map((r) =>
            // A dawn item that recovers on a die roll is left alone: rolling is
            // the mechanic, and a long rest would hand back charges the item
            // never granted. Scoped to "dawn" deliberately — a `recharge:
            // "long"` resource means what it says, dice or no dice.
            r.recharge === "dawn" && r.rechargeDice
              ? r
              : r.recharge === "long" || r.recharge === "short" || r.recharge === "dawn"
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
            weapons: c.weapons ?? [],
            racialFreeCastsUsed: c.racialFreeCastsUsed ?? {},
            hitDice: c.hitDice ?? { die: 8, max: c.level, spent: 0 },
            // Library JSON and hand-edited files may author abilities as plain
            // numbers; coerce to the base/feat/magic breakdown shape.
            abilities: normalizeAbilities(c.abilities),
          },
          // Default to "custom" when the caller didn't tell us where the
          // character came from (e.g. Settings file import).
          activeCharacterId:
            opts && "sourceId" in opts ? opts.sourceId ?? null : "custom",
          // An import has no library origin, so it must CLEAR any revision left
          // over from the character it replaced — otherwise the header would
          // compare a custom sheet against someone else's library entry.
          libraryRevision:
            opts && "sourceId" in opts ? opts.revision ?? null : null,
        }),
      resetToSample: () =>
        set({
          character: sampleWizard,
          activeCharacterId: "sample",
          libraryRevision: null,
        }),
      exportJson: () => JSON.stringify(get().character, null, 2),
    }),
    {
      name: "arcanist-ledger:character",
      // v4: added activeCharacterId for the cloud character library.
      // v5: abilities became base/feat/magic breakdowns. Migrate in place so
      // users keep their active character instead of re-picking.
      // v6: added libraryRevision. No migration body needed — zustand's default
      // merge is {...currentState, ...persistedState}, so the absent key already
      // resolves to the initial null. Do NOT rebuild the state object here; that
      // is how you drop activeCharacterId.
      version: 6,
      migrate: (persisted, version) => {
        const state = persisted as { character?: Character } | undefined;
        if (state?.character && version < 5) {
          state.character = {
            ...state.character,
            abilities: normalizeAbilities(state.character.abilities),
          };
        }
        return state as CharacterState;
      },
    },
  ),
);

// Selectors / helpers

export function savingThrow(c: Character, ability: Ability): number {
  const mod = abilityMod(abilityScore(c, ability));
  const prof = c.savingThrowProficiencies.includes(ability) ? c.proficiencyBonus : 0;
  return mod + prof;
}

export function spellSaveDc(c: Character): number {
  if (c.spellSaveDcOverride != null) return c.spellSaveDcOverride;
  const ab = c.spellcastingAbility ?? "int";
  return 8 + c.proficiencyBonus + abilityMod(abilityScore(c, ab));
}

export function spellAttackBonus(c: Character): number {
  if (c.spellAttackBonusOverride != null) return c.spellAttackBonusOverride;
  const ab = c.spellcastingAbility ?? "int";
  return c.proficiencyBonus + abilityMod(abilityScore(c, ab));
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
 *
 * Innate rituals — granted by lineage, a feat or an item — are always included:
 * there is no preparation step for a spell that was never prepared in the first
 * place. Without them, an item literally called a Ritual-Grimoire has its
 * rituals missing from the page called Ritual Archive, and so does High Elf
 * Detect Magic.
 */
export function availableRituals(c: Character): Spell[] {
  const fromBook = c.spellbook.filter((s) => s.ritual);
  const book =
    c.className.trim().toLowerCase() === "wizard"
      ? fromBook
      : fromBook.filter((s) => c.preparedSpells.includes(s.name));
  return [...book, ...c.innateSpells.filter((s) => s.ritual)];
}
