# Design — Adding your own spells, and keeping them

Date: 2026-08-03
Status: approved inline by the user (brainstorm 2026-08-03), then **substantially revised
after an adversarial spec review** — see "Revisions after review" at the end. The review
found two ways the first draft lost hand-typed spells, and the survival mechanism changed
because of it.

## Problem

Spell content is **write-once**. It enters the app only through `loadCharacter` — the
library JSON, a Fight Club XML import, or a pasted JSON file — and the only spell mutation
the UI offers is `togglePrepared`. There is no way to add, edit or delete a spell.

So when the user copies a scroll into her spellbook at the table, or levels up, her only
route is: tell Claude, wait for a commit to `public/characters/lyari.json`, wait for a
deploy, then tap **Ficha** to reload — which resets current HP, spell slots, resource
charges and concentration. That is unusable mid-session.

## Goals

- Add a **leveled spell** to `spellbook` and a **cantrip** to `cantrips`, from inside the
  app, with fields typed by hand.
- **Edit and delete** the spells she added. The ones from the library stay untouchable.
- What she adds **syncs to her other devices** and **survives tapping Ficha** — the button
  that reloads the character from the library — and survives switching characters and back.

## Non-goals

- **A spell catalog.** Explicitly chosen against: no SRD dataset to ship or maintain, and
  homebrew or off-list spells work the same as any other. She types the fields.
- **Editing library spells.** Fixing a bad import stays a commit to the character JSON.
- **Adding innate spells** (`innateSpells`). Lineage/feat/item grants carry
  `freeCastsPerLongRest` and prepared-less semantics; she does not need to author those.
- **Promoting a custom spell into the library JSON**, automatically or on request.
- **Editing `spellSlotsMax`.** Learning a spell is not gaining a slot.
- **Syncing `preparedSpells`.** Preparation is a per-day session choice and stays local,
  consistent with current HP, slots, conditions and concentration. A spell added on the
  phone therefore arrives on the tablet **unprepared** — one tap on an existing control.
  This is a decision, not an oversight.
- **Moving a spell across the cantrip/leveled boundary by editing it** — see "Editing".

## The decision that shapes everything

The user first asked the obvious question: *can't the spell just be added to the sheet?*
It cannot, not in the sense she meant. `public/characters/lyari.json` is a **static asset
in the repo**, shipped with the build and served read-only; the browser can fetch it and
never write it. Baking a spell in there requires a commit.

What *can* hold her edits is the **cloud copy**. So the spell she adds lives in her
character state, travels through the existing sync, and is re-applied on top of whatever
sheet the library hands back.

### Rejected: putting the whole spellbook in `DurableSheet`

Syncing `spellbook` and `cantrips` wholesale was rejected. A device still on an older
library revision would push its **entire** stale spellbook, and the next `Traer` elsewhere
would overwrite a spellbook the library had already updated. Only the spells she authored
need to travel.

### Rejected: carrying customs across `loadCharacter` by comparing ids

The first draft kept custom spells only inside `character.spellbook`, and re-applied them
across a reload when `nextId === activeCharacterId`. The review killed it. Lyari → Brunella
→ Lyari drops them on the way back (`carry` is false in both directions), and the resulting
compare-and-set rejection puts the header into `conflict`, whose **first** button is
Guardar → `pushNow({ force: true })` → a sheet with an empty custom list, which propagates
as a deletion to every other device. Permanent loss, reachable by normal use: there are two
library characters and she plays both.

The fix is to stop deriving survival from the character at all.

## Data model

### A per-character stash, keyed the way purses already are

`useCharacter` gains one persisted field:

```ts
/**
 * Spells the player authored in-app, keyed by character id — the same shape
 * `useCoin.purses` uses, and for the same reason: the character object is
 * replaced wholesale by every load, and anything that must outlive a reload
 * cannot live inside it.
 */
customSpells: Record<string, { spellbook: Spell[]; cantrips: Cantrip[] }>;
```

The stash is the **single source of truth**. What the rest of the app renders is a
projection of it into the character, rebuilt by one pure, idempotent function:

```ts
/** Character with its custom entries replaced by the stash's. Idempotent. */
export function projectCustoms(c: Character, stash: CustomSpells): Character {
  return {
    ...c,
    spellbook: [...c.spellbook.filter((s) => s.source !== "custom"), ...stash.spellbook],
    cantrips: [...c.cantrips.filter((s) => s.source !== "custom"), ...stash.cantrips],
  };
}
```

Every path funnels through it — add, edit, delete, `loadCharacter`, and applying a remote
sheet — so the projection cannot drift from the stash. **No sorting**: `Spellbook.tsx:41`
already sorts the spellbook with the same comparator and `preparedNonRituals` sorts too,
while the cantrip grid and the Rituals tab render in array order. Sorting here would
reorder library content on a pull for no gain; appending is predictable.

**Persist version bumps 6 → 7.** The persisted shape genuinely changes now — a new state
key — so this is the bump `CLAUDE.md` asks for. The `migrate` body stays empty: zustand's
default merge is `{...currentState, ...persistedState}`, so the absent key resolves to the
initial `{}`. Do **not** rebuild the state object in `migrate`; that is how `activeCharacterId`
gets dropped.

### `SpellSource` gains `"custom"`

```ts
export type SpellSource =
  | "class" | "subclass" | "race" | "background" | "feat" | "item"
  | "custom";
```

That is the only change to `Character` itself. A custom spell is an ordinary entry in
`spellbook` or `cantrips`, tagged — so `findSpell`, `availableRituals`, `preparedNonRituals`,
`SpellCard`, the search and the level filters all keep working untouched.

**No spell `id`.** Identity across the app is the `name` string: `preparedSpells`,
`Resource.itemSpell.name`, `concentration.spellName` and every React key. An id for custom
spells only would put two identity schemes in one list. Names must therefore stay unique
and renames must be followed through — both specified below.

### `DurableSheet` gains one field, always emitted

```ts
export interface DurableSheet {
  // …existing fields…
  /**
   * Spells the player authored in-app. ALWAYS emitted, empty arrays included:
   * an empty list means "she has none", which is how a deletion reaches the
   * other devices. Absent means "pushed by a build that predates this field".
   */
  customSpells: { spellbook: Spell[]; cantrips: Cantrip[] };
}
```

The absent-vs-empty distinction is the crux, and the first draft left it undefined. The
choice is **always emit**, because deletion is a real user intent that has to travel;
omitting the key when empty would make her last deletion indistinguishable from an old
build's push, and the spell would resurrect on the next pull elsewhere.

The cost is paid once: `digestState` hashes a stable stringification that enumerates
`Object.keys` (`syncFlags.ts:16`), so a new key changes the digest for **every install,
including those with no custom spells**. On the first boot after this ships every device
reads `dirty`, and a device that is also `remoteAhead` renders `conflict` — whose first
button is a force push (`syncFlags.ts:91`, `HeaderStatus`). At that moment nobody has
custom spells yet, so nothing can be lost by it; it resolves on the first Guardar or Traer.
This is stated so it is recognised as expected rather than debugged as a regression.

### Applying a remote sheet: a store action, not a bare `applyDurable`

The pull path currently does `applyDurable(s.character, remote.sheet)` inline
(`sync.ts:176-178`). Custom spells must also land in the stash, so this becomes a store
action mirroring `applyRemotePurse`:

```ts
applyRemoteSheet(cid: string, sheet: DurableSheet): void
```

which applies the durable fields, then:

- if `sheet.customSpells` is **present** → `stash[cid] = sheet.customSpells`, reproject;
- if **absent** (older build) → keep the local stash untouched and reproject. Taking it
  verbatim would silently delete every custom spell on every device — the trap
  `applyRemotePurse` (`coin.ts:327-340`) already guards for magic items.

### The backfill must leave the device dirty

The backfill guard alone is not enough, and this is the second thing the review caught.
`pullNow` sets the baseline to the digest of the **post-merge local** payload
(`sync.ts:186`). So after a backfill the header computes `dirty: false` and renders
**synced**, green — while the cloud holds none of her spells and this device will never
push them. The app would be affirmatively lying about her data being safe.

The baseline must be *what we believe the cloud holds*, not what we ended up with:

```ts
// The honest baseline is the remote payload, not the merged local one: when a
// backfill kept data the cloud does not have, this device DOES have unsaved
// work and the header must keep offering Guardar.
if (remote) setBaseline(digestState({ sheet: remote.sheet, coin: remote.coin }));
```

This is a one-line change plus a test. It is a deliberate, small scope addition rather than
an accepted non-goal, because without it the feature ships a green "synced" over missing
data — and it closes the identical pre-existing hole for magic items in the same stroke.

## Surviving `loadCharacter`

`loadCharacter(c, opts)` becomes `set((s) => …)` and reprojects from the stash bucket of
the **incoming** character:

| path | `sourceId` | bucket used | result |
|---|---|---|---|
| Ficha / library reload | the active id | `stash[id]` | customs re-applied — the goal |
| Switch Lyari → Brunella | `brunella` | `stash["brunella"]` | Brunella's own, never Lyari's |
| Switch back | `lyari` | `stash["lyari"]` | **restored** — the case the old rule lost |
| Settings import (XML/JSON) | none → `"custom"` | **cleared**, then empty | see below |
| `resetToSample` | `"sample"` | `stash["sample"]` | its own bucket, normally empty |

**An import clears the `"custom"` bucket.** Every import lands in the same `"custom"` id,
so without this, spells typed for one imported stranger would follow her onto the next —
which is precisely the mixing the id rule exists to prevent, and the first draft's rationale
had it backwards. An import is a declared fresh start.

Library reload is airtight for the goal case: `useLibrary.reload` derives the id from
`activeLibraryId()` and passes it back as `sourceId`, so the bucket always matches.

**Promotion still works with no user action:** when the projection runs, a stash entry whose
name the incoming sheet already has (case-insensitive) is **dropped from the stash**. Once
Fireball is committed to `lyari.json`, the next reload keeps the library's copy and the
duplicate custom disappears for good.

## Behaviour

### Adding

A **`+ Add spell`** button in the `Spellbook` view header opens a form. Copy on that page is
English.

| Field | Required | Notes |
|---|---|---|
| Name | yes | Trimmed. Rejected if it collides (case-insensitive) with any name in `spellbook`, `cantrips` or `innateSpells`. |
| Level | yes | `Cantrip` or 1–9 (reuse `SPELL_LEVELS`, `constants.ts:42`). **Level decides the list**: cantrip → `cantrips`, else → `spellbook`. |
| School | yes | Eight options. `SpellSchool` is a *type* with no runtime array, so add a `SPELL_SCHOOLS` const in `constants.ts` beside `SCHOOL_ICONS` rather than inventing a literal list in the form. |
| Casting time, Range, Components, Duration | no | Free text, as imported spells already are. |
| Ritual, Concentration | no | Checkboxes, **hidden for cantrips** — `Cantrip` has no such fields. |
| Description | no | Textarea. Optional on purpose: typing full rules text on a phone mid-session is not something to require. |

Name collision is a **hard block with an inline message**. Name is the identity key
everywhere; two spells sharing one makes `togglePrepared`, `findSpell` and concentration
ambiguous.

The new spell is saved with `source: "custom"` and is **not** auto-prepared.

### Editing and deleting

Rendered only when `source === "custom"`, in **three** places — the review found the first
draft named only one, which would have left custom cantrips uneditable and unidentifiable:

- **`SpellCard`** (`Spellbook`, leveled) — edit + delete, in the sibling action row that
  already exists next to the expand toggle (`SpellCard.tsx:70`).
- **`CantripCard`** (`Spellbook`, cantrips) — the whole card is currently one toggle button,
  so it gains an action row of the same shape as `SpellCard`'s.
- **`CompactCantripRow`** / **`CompactSpellRow`** (`Encounter`) — the **`Custom` chip only**,
  beside the existing source chips. Encounter is the at-the-table view; editing belongs on
  the Spellbook page, and a delete button next to a cast button is a bad idea mid-combat.

**Delete is a two-step inline confirm on the button itself** (`Delete` → `Sure?`, reverting
after a few seconds), not a modal. The user has already rejected a confirm dialog on a
destructive action; this keeps the safety without the interruption, and a hand-typed
description is real work to lose.

**Level is editable only within its kind.** A cantrip stays a cantrip; a leveled spell can
change among 1–9. Allowing the boundary crossing would mean silently discarding
`ritual`/`concentration` on demotion, and stranding a name in `preparedSpells` that no
`spellbook` entry answers to any more — all for a case fixed by delete-and-re-add.

### Rename follow-through

`updateCustomSpell(originalName, patch)` must, in one `set`:

1. rewrite the stash entry and reproject;
2. replace `originalName` in `preparedSpells` if present, preserving preparation;
3. rewrite `concentration.spellName` if she is concentrating on it;
4. re-run the collision check against the new name.

Deleting symmetrically removes the name from `preparedSpells` and drops `concentration` if
it names the deleted spell.

`concentration.level` is **not** touched by a level edit: it records the level the spell was
*cast at*, which stays true regardless of the spell's base level.

`Resource.itemSpell.name` is **not** rewritten. Item-bound spells are authored in the
character JSON against library spells, and `findSpell` does not search `cantrips` anyway.
Noted rather than pre-solved.

### The store actions refuse non-custom spells

`updateCustomSpell` and `removeCustomSpell` no-op when the named spell is missing from the
stash. The UI hides the controls; the guard is what makes "library spells are untouchable" a
property of the model rather than of the rendering.

### Rituals a non-Wizard has not prepared

Found by the user testing the built feature on **Brunella**, a Bard: she added a ritual, it
saved correctly and showed under **Spellbook**, and the **Rituals** tab did not list it.

Not a bug in this feature — `availableRituals` filters a non-Wizard's spellbook rituals by
preparation, which is RAW for 2024 (only the Wizard's Ritual Adept casts unprepared rituals
from the book), and a new custom spell is deliberately not auto-prepared. But the page said
nothing about preparation, so the only reading available to her was "the spell failed to
save". The same gap already hid every unprepared ritual Brunella owned; adding spells just
made it reachable in one step.

So the Rituals tab gains a **"Needs preparing"** section, fed by a new pure selector
`ritualsNeedingPreparation(c)` — empty for Wizards, since theirs are already castable and
listing them twice is worse than not listing them — rendered with the prepare star so it is
one tap to fix. Innate rituals are never in it: they need no preparing.

### A spell she cannot cast yet

`SpellCard` derives its cast levels from `spellSlotsMax`, so a custom level-7 spell on a
level-5 caster renders with the cast button disabled ("No spell slots available"). That is
correct — you can scribe a scroll you cannot yet cast — and is called out so it is not
reported as a bug.

## Testing

**Unit — `src/lib/durableSheet.test.ts`** (extending): `extractDurable` always emits
`customSpells`, empty arrays included; `applyDurable` still preserves volatile state.

**Unit — `src/lib/projectCustoms` (new, colocated test):** replaces custom entries, leaves
library entries untouched and in order, is idempotent under repeated application, and drops
a stash entry whose name the incoming sheet already has.

**Unit — `src/store/character.test.ts`** (extending, reusing the `makeChar` factory):
- level 0 lands in `cantrips`, leveled in `spellbook`, both tagged and both in the stash;
- duplicate names rejected, including against `innateSpells` and across casing;
- rename keeps preparation and follows concentration;
- delete prunes `preparedSpells` and drops matching concentration;
- `updateCustomSpell`/`removeCustomSpell` refuse a library spell;
- **`loadCharacter` switches buckets**: Lyari → Brunella → Lyari restores Lyari's customs;
- an import (no `sourceId`) clears the `"custom"` bucket;
- `applyRemoteSheet` with `customSpells` absent keeps the local stash; with it present,
  replaces it.

**Unit — `src/lib/syncFlags.test.ts` / store test:** after a pull whose remote sheet lacked
`customSpells` while local had some, the device reads **dirty**, not synced. This is the
regression guard for the green-lie described above; it is the single most important test
here.

**Component, jsdom — the form** (new file, `// @vitest-environment jsdom` docblock as the
four existing component tests do): required fields block submission, the duplicate message
appears, ritual/concentration are hidden for a cantrip, and a submitted spell reaches the
store in the right list.

**Manual, headless Chrome** via `$TEMP/uitest/shootp.mjs` with a persistent profile: add a
spell, confirm the `Custom` chip and that it is searchable and preparable; reload from the
library and confirm it survives; switch to Brunella and back and confirm it is still there.
The survival claims span two boots, which is what the persistent-profile harness exists for.
Navigate to `about:blank` before the screenshot so late `localStorage` writes flush.

**Not covered by tests, stated plainly:** the real cross-device round trip. Local dev writes
to **production** Upstash, so it will be exercised with sync disabled or against a throwaway
character id, never by pushing real data from a test.

## Risks

- **Name identity.** Mitigated by the collision block and the rename follow-through, but it
  stays the sharpest edge here. An id scheme is the escape hatch if it bites.
- **Two representations.** The stash and the projection must agree; `projectCustoms` being
  pure, idempotent and the only writer is what makes that safe, and it is tested directly.
- **Payload growth.** Descriptions are a few KB and the sheet travels whole on every
  debounced push. Ten spells is nothing; a hundred would not be, and nothing enforces a
  limit. Worth watching rather than pre-optimising.
- **Typing at the table.** The price of not shipping a catalog. Only name, level and school
  are required, so a spell can be added in fifteen seconds and fleshed out later.

## Revisions after review

An adversarial subagent reviewed the committed spec against the code. It confirmed the
`loadCharacter` mechanics (a plain `set({...})` today, `activeCharacterId` genuinely still
holding the old id), that the pull path cannot echo a merged list back through the debounce
thanks to `withHydration`, that a leaked `level: 0` on a cantrip would be inert (and would
not typecheck), that skipping the persist bump was right *for the original design*, that
leaving `preparedSpells` local is defensible, and that a jsdom form test is realistic here.
Applied:

1. **Blocker — the survival rule lost data on a normal path.** Lyari → Brunella → Lyari
   dropped the customs and then offered a force push that would have deleted them from the
   cloud too. Replaced by a per-character stash keyed like `useCoin.purses`. This is the
   largest change and it is what drove the persist bump to 7.
2. **Blocker — the backfill guard produced a green "synced" over a cloud with none of her
   spells,** because `pullNow` baselines the post-merge local payload. The baseline now
   digests the remote payload; the device stays dirty and keeps offering Guardar.
3. **The digest churn on upgrade was unexamined.** Adding a key flips `dirty` for every
   install and can surface `conflict`, whose first button force-pushes. Harmless on the
   upgrade itself, but it is now written down instead of being discovered as a bug.
4. **Absent vs present-but-empty was undefined.** Settled: always emit, so deletions travel.
5. **Custom cantrips were unreachable.** `CantripCard` is a separate component with no
   action row and `CompactCantripRow` a third; both are now named, with editing kept off the
   Encounter view.
6. **The import rationale was backwards** — two imports share the id `"custom"`, so the old
   rule mixed exactly the characters it claimed to separate. An import now clears the bucket.
7. **The sort in `applyDurable` contradicted "library entries are never touched"**, and was
   dead code for the two tabs that already sort while reordering the two that do not. Dropped.
8. `resetToSample` was an unlisted third replacement path; it falls out of the bucket rule.
9. Level is no longer editable across the cantrip/leveled boundary — the first draft allowed
   the move and specified follow-through only for renames.
10. `SpellSchool` is a type with no runtime array; the form needs a new `SPELL_SCHOOLS` const.
11. Dropped the false claim that the Spellbook page is entirely English (`SpellCard` renders
    "Ver más"). English is still right for the new copy; the justification was wrong.
12. Added the uncastable-high-level-spell note and the `findSpell`-ignores-cantrips note.

**Rejected from the review:** its claim that a level edit staled `concentration.level`.
That field records the level the spell was cast at, which does not change because the
spell's base level was corrected. The boundary-crossing ban (item 9) removes the rest of
that finding's substance.

## Open questions

None.
