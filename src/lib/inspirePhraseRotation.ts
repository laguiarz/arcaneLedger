/**
 * Rotation for inspire-phrase decks. Tracks which phrases of each (deck, tag)
 * pair have already been shown — keyed by phrase text, not index, so adding
 * or reordering phrases in the deck won't break tracking. When a pool is
 * exhausted, the "used" set resets and rotation starts over (avoiding the
 * most-recent picks to prevent immediate repeats).
 */

import { getInspirePhraseDeck, type InspireTag } from "@/data/inspirePhrases";

const STORAGE_KEY = "arcanist-ledger:inspirePhraseUsage";

type UsageMap = Record<string, string[]>;

function loadUsage(): UsageMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as UsageMap) : {};
  } catch {
    return {};
  }
}

function saveUsage(usage: UsageMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // Storage full / unavailable — fail silent; rotation still works in-memory.
  }
}

function poolFor(deckName: string, tag: InspireTag): string[] {
  const deck = getInspirePhraseDeck(deckName);
  if (!deck) return [];
  return deck.filter((p) => p.tags.includes(tag)).map((p) => p.text);
}

const trackerKey = (deckName: string, tag: InspireTag) => `${deckName}:${tag}`;

/**
 * Pick `count` distinct phrases from a deck/tag pool. Random pick from unused
 * phrases first; if the pool is exhausted mid-draw, refill (preserving the
 * just-picked phrases to avoid immediate repeats) and continue. Returns fewer
 * than `count` only if the pool itself is smaller. Persists usage so calls
 * across sessions keep rotating.
 */
export function nextInspirePhrases(
  deckName: string,
  tag: InspireTag,
  count: number,
): string[] {
  const pool = poolFor(deckName, tag);
  if (pool.length === 0 || count <= 0) return [];

  const usage = loadUsage();
  const key = trackerKey(deckName, tag);
  const stored = usage[key] ?? [];

  // Filter to phrases still in the current pool (drops stale stored entries).
  const used = new Set(pool.filter((p) => stored.includes(p)));
  const picked = new Set<string>();
  const result: string[] = [];

  const target = Math.min(count, pool.length);
  while (result.length < target) {
    let candidates = pool.filter((p) => !used.has(p) && !picked.has(p));
    if (candidates.length === 0) {
      // All used — reset, but keep just-picked excluded so we don't echo them.
      used.clear();
      candidates = pool.filter((p) => !picked.has(p));
      if (candidates.length === 0) break;
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    picked.add(pick);
    used.add(pick);
    result.push(pick);
  }

  saveUsage({ ...usage, [key]: Array.from(used) });
  return result;
}
