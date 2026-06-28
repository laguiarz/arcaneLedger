import type { Combatant } from "@/types/combat";
import { CONDITIONS } from "@/lib/constants";
import {
  activeConditionsInRound,
  isInactive,
  sortByInitiative,
} from "@/lib/combat";

const condLabel = (id: string) =>
  CONDITIONS.find((c) => c.id === id)?.label ?? id;

/**
 * Flatten a finished combat into a compact, human-readable transcript for the
 * narration model. Pure and deterministic so it can be unit-tested and so the
 * exact text fed to the AI is reviewable.
 *
 * The output lists, round by round, what each combatant did (using the typed
 * action text, or a bare "acts" when only the "acted" flag was set), plus any
 * conditions still riding on each combatant at the end.
 */
export function buildNarrationPayload(
  combatants: Combatant[],
  totalRounds: number,
  activeName?: string,
): string {
  // Inactive combatants (initiative 0) sat the fight out — leave them out.
  const ordered = sortByInitiative(combatants).filter((c) => !isInactive(c));
  const lines: string[] = [];

  lines.push(`Total rounds: ${Math.max(totalRounds, 1)}`);
  if (activeName) lines.push(`Narrator / point-of-view character: ${activeName}`);

  lines.push("", "Combatants:");
  for (const c of ordered) {
    const init = c.initiative != null ? `init ${c.initiative}` : "init —";
    lines.push(`- ${c.name} (${c.kind}, ${init})`);
  }

  for (let round = 1; round <= Math.max(totalRounds, 1); round += 1) {
    const entries = ordered
      .map((c) => {
        const a = c.actions[round];
        if (!a || !a.acted) return null;
        const what = a.text?.trim() ? a.text.trim() : "acts";
        return `  - ${c.name}: ${what}`;
      })
      .filter((x): x is string => x !== null);

    const conds = ordered
      .map((c) => {
        const active = activeConditionsInRound(c, round);
        if (active.length === 0) return null;
        return `${c.name} is ${active.map((x) => condLabel(x.id)).join(", ")}`;
      })
      .filter((x): x is string => x !== null);

    if (entries.length === 0 && conds.length === 0) continue;
    lines.push("", `Round ${round}:`, ...entries);
    if (conds.length > 0) lines.push(`  Conditions: ${conds.join("; ")}`);
  }

  return lines.join("\n");
}

/** True when there is at least one recorded action worth narrating. */
export function hasNarratableActions(combatants: Combatant[]): boolean {
  return combatants.some((c) =>
    Object.values(c.actions).some((a) => a.acted),
  );
}
