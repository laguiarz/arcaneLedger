# Library update notice — implementation plan

**Spec:** `docs/superpowers/specs/2026-08-02-library-update-notice-design.md`
**Branch:** `feat/library-update-notice`

Order matters: the revision has to exist before anything can compare it, and the
pure decision function has to exist before the store or the header can use it.

---

## Step 1 — The digest scripts

**Create `scripts/libraryDigest.mjs`**

- `stableStringify(v)` — same algorithm as `stable()` in `src/lib/syncFlags.ts`
  (null/primitive → `JSON.stringify`; array → recurse in order; object → keys
  sorted, recurse).
- `digestCharacter(parsed)` → `createHash("sha256").update(stableStringify(parsed)).digest("hex").slice(0, 12)`.
- Import `createHash` from `node:crypto`. No other imports, no side effects.

**Create `scripts/stampLibrary.mjs`**

- Resolve the repo root from `import.meta.url` (`../` of `scripts/`), so it works
  regardless of cwd.
- Read `public/characters/manifest.json`, `JSON.parse` it.
- For each entry: read `public/characters/<id>.json`, parse, `digestCharacter`.
  A missing/unparseable character file is a hard error (exit 1) in both modes.
- `--check` mode: compare each entry's existing `revision` against the computed
  one. Print the offending ids and exit 1 on any mismatch or missing revision;
  exit 0 otherwise. **Writes nothing.**
- Default mode: set `entry.revision`, write back with
  `JSON.stringify(manifest, null, 2) + "\n"`, print what changed.

**Edit `package.json`**

- `"build": "node scripts/stampLibrary.mjs && tsc -b && vite build"`
- add `"library:stamp": "node scripts/stampLibrary.mjs"`

**Run** `npm run library:stamp` and commit the stamped `manifest.json`.

---

## Step 2 — Types and the store field

**`src/types/characterLibrary.ts`** — add to `CharacterSummary`:

```ts
/** Content digest of the character JSON, stamped by scripts/stampLibrary.mjs.
 *  Optional: manifests published before revisions existed have none. */
revision?: string;
```

`src/lib/characterLibrary.ts` needs **no change** — its `.filter()` is a type
predicate and already passes the whole object through.

**`src/store/character.ts`**

- Add `libraryRevision: string | null` to `CharacterState` with the doc comment
  from the spec; initial value `null`.
- Widen `loadCharacter`'s signature to
  `(c: Character, opts?: { sourceId: string | null; revision?: string | null })`
  — `sourceId` **required** inside `opts`.
- In the setter, keep the existing `"sourceId" in opts` idiom for
  `activeCharacterId`, and set
  `libraryRevision: opts && "sourceId" in opts ? opts.revision ?? null : null`.
- `resetToSample()` sets `libraryRevision: null`.
- Bump persist `version` 5 → 6. Extend the existing migrate's comment block; the
  v5→v6 body is a **pass-through** (zustand's default merge supplies `null`).
  Do not reconstruct the state object.

---

## Step 3 — The pure decision

**Create `src/lib/libraryFlags.ts`** with `LibraryNotice` and `libraryNotice(...)`
exactly as specified, evaluated in the spec's table order (`appUpdatePending`
first, then origin, then `availableRevision === null`, then
`loadedRevision === null`, then comparison).

Document *why* `appUpdatePending` wins and why `"unknown"` exists, in the file —
both are non-obvious and both came out of the review.

---

## Step 4 — `withHydration`

**`src/store/sync.ts`** — export, near the `hydrating` declaration:

```ts
export function withHydration<T>(fn: () => T): T {
  hydrating = true;
  try { return fn(); } finally { hydrating = false; }
}
```

Refactor `pullNow`'s existing inline `hydrating = true / finally` block to use it,
so there is one implementation rather than two.

---

## Step 5 — The library store

**Create `src/store/library.ts`** implementing `LibraryState` from the spec.

- `check()`: bail unless the active id is a library id (not `null`, `"sample"`,
  `"custom"`); set `checking`; `fetchLibraryManifest()`; on success **always**
  `set({ availableRevision: entry?.revision ?? null, lastError: null })`; on
  failure set `lastError` only. Always clear `checking` in a `finally`.
- `reload()`: bail if `reloading` or not a library id. Fetch the manifest **and**
  the character (`Promise.all`), take the revision from *that* manifest response,
  then
  ```ts
  withHydration(() => loadCharacter(character, { sourceId: id, revision: rev }));
  useSync.getState().recompute();
  set({ availableRevision: rev });
  ```
  On failure set `lastError`. Always clear `reloading` in a `finally`.
- A small exported helper `isLibraryId(id)` shared by both and by the tests.

---

## Step 6 — Wiring

**`src/main.tsx`**

- `maybeCheck()` also calls `void useLibrary.getState().check()`.
- The `activeCharacterId` subscription also does
  `useLibrary.setState({ availableRevision: null, lastError: null })`.

**`src/components/library/LibraryPicker.tsx`** — pass
`revision: s.revision ?? null` in the existing `loadCharacter` call.

**`vite.config.ts`** — comment above `globPatterns` recording that `json` must
stay out of the precache or the manifest freezes at build time.

---

## Step 7 — The header

**`src/components/HeaderStatus.tsx`**

- Read `libraryRevision` from `useCharacter`, `availableRevision` / `reloading` /
  `reload` from `useLibrary`.
- `const notice = libraryNotice({ activeCharacterId, loadedRevision: libraryRevision, availableRevision, appUpdatePending: needRefresh })`.
- Render the button before the sync `<div role="status">` block when
  `notice !== "none"`: primary-accented styling copied from the "Actualizar"
  button, `menu_book` icon, `Ficha` label (`hidden md:inline`), the two labels
  from the spec, `disabled={reloading}`, spinner `progress_activity` while
  reloading.

**`src/views/Settings.tsx`** — in the Library section, render
`useLibrary(s => s.lastError)` as a small error line when set.

---

## Step 8 — Tests

Co-located `*.test.ts(x)`, Vitest, `// @vitest-environment jsdom` only where DOM
is needed.

1. **`src/lib/libraryFlags.test.ts`** — the whole decision table: app update wins;
   `null`/`sample`/`custom` → none; unchecked → none; unknown origin → unknown;
   mismatch → update; match → none.
2. **`src/lib/characterLibrary.test.ts`** (new) — the stamp guard via
   `execFileSync(process.execPath, ["scripts/stampLibrary.mjs", "--check"], { cwd: repoRoot })`
   asserting exit 0; plus `fetchLibraryManifest` with a stubbed `fetch` keeping
   `revision`, tolerating entries without one, and tolerating a bare array.
3. **`src/store/character.test.ts`** (extend) — the first coverage of origin:
   `loadCharacter` with `{sourceId, revision}` records both; with `{sourceId}`
   only → revision `null`; with no opts → `"custom"` + `null`; `resetToSample`
   clears both.
4. **`src/store/library.test.ts`** (new) — `check()` no-ops for `custom`; writes
   the revision; writes `null` when the entry is gone; leaves it untouched and
   sets `lastError` on a rejected fetch. `reload()` calls `loadCharacter` with the
   revision from its own manifest fetch even when `availableRevision` changed
   mid-flight (drive it by resolving the character fetch after mutating the
   store); refuses re-entry while `reloading`.
5. **`src/components/HeaderStatus.test.tsx`** (extend) — button appears for a
   stale library character, absent when fresh, absent when `needRefresh` is
   mocked true. The file already mocks `virtual:pwa-register`.

---

## Step 9 — Validation

One command per call: `npx tsc --noEmit`, then `npx vitest run`, then
`npx vite build`. Then verify in the browser on port 5180 with the existing
`$TEMP/uitest/shoot.mjs` harness: load Brunella, hand-edit the served manifest
revision (or stamp after touching the JSON) and confirm the Ficha button appears,
reloads, and disappears. Assert the build hash in the scenario.

---

## Notes for the implementer

- **`.env.local` holds real Upstash credentials** — the local dev server writes to
  production. Do not press Guardar while testing.
- Dev port is **5180**. Never kill the PID on 5173.
- Bash is Git Bash: commit messages go through `-F <file>`.
- The `--check` test must use `process.execPath`, not `"node"`, and no shell.
