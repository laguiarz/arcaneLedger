/**
 * Action-economy classification for the Encounter quick filters.
 *
 * Spells/cantrips carry a free-text `castingTime` string with inconsistent
 * formatting across data sources ("Action", "1 action", "Bonus Action",
 * "1 bonus action", "1 reaction, which you take when ..."), so we classify by
 * case-insensitive substring matching. Resources have no casting time and are
 * tagged directly via {@link Resource.actionType}.
 */

import type { ActionType } from "@/types/character";
export type { ActionType };

/** The active quick-filter selection. "all" disables filtering. */
export type ActionFilter = "all" | ActionType;

/**
 * Classify a spell/cantrip `castingTime` string into an action type.
 *
 * Order matters: "bonus action" contains "action", so bonus and reaction are
 * checked before the generic "action" fallback. Anything that isn't one of the
 * three combat action types (e.g. "1 minute", "10 minutes") returns "other"
 * and only appears under the "All" filter.
 */
export function classifyCastingTime(castingTime?: string): ActionType | "other" {
  if (!castingTime) return "other";
  const s = castingTime.toLowerCase();
  if (s.includes("bonus action")) return "bonus";
  if (s.includes("reaction")) return "reaction";
  if (s.includes("action")) return "action";
  return "other";
}

/** Does a spell/cantrip (by its castingTime) match the active filter? */
export function castingTimeMatchesFilter(
  filter: ActionFilter,
  castingTime?: string,
): boolean {
  if (filter === "all") return true;
  return classifyCastingTime(castingTime) === filter;
}

/** Does a resource (by its optional actionType tag) match the active filter? */
export function actionTypeMatchesFilter(
  filter: ActionFilter,
  actionType?: ActionType,
): boolean {
  if (filter === "all") return true;
  return actionType === filter;
}

/** UI metadata for each filter chip, in display order. */
export const ACTION_FILTERS: ReadonlyArray<{
  value: ActionFilter;
  label: string;
  /** Material Symbols icon name. */
  icon: string;
}> = [
  { value: "all", label: "All", icon: "filter_list" },
  { value: "action", label: "Action", icon: "bolt" },
  { value: "bonus", label: "Bonus", icon: "fast_forward" },
  { value: "reaction", label: "Reaction", icon: "u_turn_left" },
];
