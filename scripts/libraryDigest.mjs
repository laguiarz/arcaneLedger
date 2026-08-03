import { createHash } from "node:crypto";

/**
 * Content digest for a library character.
 *
 * The digest is taken over the PARSED JSON, never over the file bytes. This
 * machine checks out CRLF while git's index and Vercel's checkout are LF, so a
 * byte-level digest would disagree between here and production and turn the
 * guard test red right after a green deploy. Parsing first also means that
 * reformatting a character file, or reordering its keys, is correctly not a
 * change.
 *
 * Node-only: these scripts never ship to the client, so unlike `digestState` in
 * `src/lib/syncFlags.ts` there is no bundle-size reason to hand-roll a hash.
 */

/** Stable stringify: object keys sorted, so key order never changes the digest. */
export function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  return `{${Object.keys(v)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
    .join(",")}}`;
}

/** 12 hex chars of sha256 — short enough to read in a diff, long enough here. */
export function digestCharacter(parsed) {
  return createHash("sha256")
    .update(stableStringify(parsed))
    .digest("hex")
    .slice(0, 12);
}
