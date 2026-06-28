import { create } from "zustand";
import type {
  Combatant,
  CombatantKind,
  CombatantCondition,
} from "@/types/combat";
import type { ConditionId } from "@/types/character";
import {
  moveItem,
  newCombatantId,
  sortByInitiative,
  tickConditions,
} from "@/lib/combat";

/**
 * Ephemeral combat state. Deliberately NOT wrapped in `persist` — a combat is
 * thrown away when it ends (or on reload). The only durable thing tied to this
 * feature is the narration config, which lives in {@link "@/lib/combatNarration"}.
 */

export interface NewCombatantInput {
  name: string;
  kind: CombatantKind;
  initiative?: number | null;
  initiativeBonus?: number;
  hp?: { current: number; max: number };
  ac?: number;
  sourceId?: string;
}

interface CombatState {
  combatants: Combatant[];
  round: number;

  addCombatant: (input: NewCombatantInput) => void;
  addCombatants: (inputs: NewCombatantInput[]) => void;
  removeCombatant: (id: string) => void;
  setInitiative: (id: string, value: number | null) => void;
  setHp: (id: string, current: number) => void;

  sort: () => void;
  move: (id: string, dir: -1 | 1) => void;

  toggleCondition: (id: string, condition: ConditionId) => void;
  setConditionRounds: (
    id: string,
    condition: ConditionId,
    rounds: number | undefined,
  ) => void;

  setAction: (id: string, round: number, text: string) => void;
  toggleActed: (id: string, round: number) => void;

  nextRound: () => void;
  reset: () => void;
}

function makeCombatant(input: NewCombatantInput): Combatant {
  return {
    id: newCombatantId(),
    name: input.name.trim() || "Unnamed",
    kind: input.kind,
    initiative: input.initiative ?? null,
    initiativeBonus: input.initiativeBonus,
    hp: input.hp,
    ac: input.ac,
    conditions: [],
    actions: {},
    sourceId: input.sourceId,
  };
}

/** Immutably replace one combatant by id via an updater. */
function patch(
  list: Combatant[],
  id: string,
  fn: (c: Combatant) => Combatant,
): Combatant[] {
  return list.map((c) => (c.id === id ? fn(c) : c));
}

export const useCombat = create<CombatState>()((set) => ({
  combatants: [],
  round: 1,

  addCombatant: (input) =>
    set((s) => ({ combatants: [...s.combatants, makeCombatant(input)] })),

  addCombatants: (inputs) =>
    set((s) => ({
      combatants: [...s.combatants, ...inputs.map(makeCombatant)],
    })),

  removeCombatant: (id) =>
    set((s) => ({ combatants: s.combatants.filter((c) => c.id !== id) })),

  setInitiative: (id, value) =>
    set((s) => ({
      combatants: patch(s.combatants, id, (c) => ({ ...c, initiative: value })),
    })),

  setHp: (id, current) =>
    set((s) => ({
      combatants: patch(s.combatants, id, (c) =>
        c.hp
          ? {
              ...c,
              hp: { ...c.hp, current: Math.max(0, Math.min(c.hp.max, current)) },
            }
          : c,
      ),
    })),

  sort: () => set((s) => ({ combatants: sortByInitiative(s.combatants) })),

  move: (id, dir) =>
    set((s) => {
      const idx = s.combatants.findIndex((c) => c.id === id);
      if (idx === -1) return {};
      return { combatants: moveItem(s.combatants, idx, dir) };
    }),

  toggleCondition: (id, condition) =>
    set((s) => ({
      combatants: patch(s.combatants, id, (c) => {
        const has = c.conditions.some((x) => x.id === condition);
        const conditions: CombatantCondition[] = has
          ? c.conditions.filter((x) => x.id !== condition)
          : [...c.conditions, { id: condition }];
        return { ...c, conditions };
      }),
    })),

  setConditionRounds: (id, condition, rounds) =>
    set((s) => ({
      combatants: patch(s.combatants, id, (c) => ({
        ...c,
        conditions: c.conditions.map((x) =>
          x.id === condition
            ? { ...x, rounds: rounds && rounds > 0 ? rounds : undefined }
            : x,
        ),
      })),
    })),

  setAction: (id, round, text) =>
    set((s) => ({
      combatants: patch(s.combatants, id, (c) => {
        const prev = c.actions[round];
        const trimmed = text.trim();
        // Typing detail implies the combatant acted.
        const acted = prev?.acted ?? false;
        return {
          ...c,
          actions: {
            ...c.actions,
            [round]: { text: trimmed || undefined, acted: acted || !!trimmed },
          },
        };
      }),
    })),

  toggleActed: (id, round) =>
    set((s) => ({
      combatants: patch(s.combatants, id, (c) => {
        const prev = c.actions[round];
        const acted = !(prev?.acted ?? false);
        return {
          ...c,
          actions: { ...c.actions, [round]: { text: prev?.text, acted } },
        };
      }),
    })),

  nextRound: () =>
    set((s) => ({
      round: s.round + 1,
      combatants: s.combatants.map((c) => ({
        ...c,
        conditions: tickConditions(c.conditions),
      })),
    })),

  reset: () => set({ combatants: [], round: 1 }),
}));
