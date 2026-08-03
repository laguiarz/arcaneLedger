# Design — Adding your own spells, and keeping them

Date: 2026-08-03
Status: approved inline by the user (brainstorm 2026-08-03).

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
  that reloads the character from the library.

## Non-goals

- **A spell catalog.** Explicitly chosen against: no SRD dataset to ship or maintain, and
  homebrew or off-list spells work the same as any other. She types the fields.
- **Editing library spells.** Fixing a bad import stays a commit to the character JSON.
  She was offered this and declined; only the spells she creates are hers to change.
- **Adding innate spells** (`innateSpells`). Lineage/feat/item grants carry
  `freeCastsPerLongRest` and prepared-less semantics; she does not need to author those.
- **Promoting a custom spell into the library JSON**, automatically or on request. If she
  ever wants Fireball baked into `lyari.json` that is a separate, manual task.
- **Editing `spellSlotsMax`.** Learning a spell is not gaining a slot.
- **Syncing `preparedSpells`.** Preparation is a per-day session choice and stays local,
  consistent with current HP, slots, conditions and concentration.

## The decision that shapes everything

The user first asked the obvious question: *can't the spell just be added to the sheet?*
It cannot, not in the sense she meant. `public/characters/lyari.json` is a **static asset
in the repo**, shipped with the build and served read-only; the browser can fetch it and
never write it. Baking a spell in there requires a commit.

What *can* hold her edits is the **cloud copy**. So the spell she adds lives in her
character state, travels through the existing sync, and is re-applied on top of whatever
sheet the library hands back.

### Rejected: putting the whole spellbook in `DurableSheet`

The straightforward version — sync `spellbook` and `cantrips` wholesale — was rejected. A
device still on an older library revision would push its **entire** stale spellbook, and
the next `Traer` on another device would overwrite a spellbook that the library had already
updated. That is the same class of silent data loss as the stale-PWA-cache bug, and it is
avoidable: only the spells she authored need to travel.

## Data model

### `SpellSource` gains `"custom"`

```ts
export type SpellSource =
  | "class" | "subclass" | "race" | "background" | "feat" | "item"
  | "custom";   // authored in-app by the player
```

That is the **only type change to `Character`**. A custom spell is an ordinary entry in
`spellbook` or `cantrips`, tagged. Every existing consumer — `findSpell`, `availableRituals`,
`preparedNonRituals`, `SpellCard`, `CompactSpellRow`, the search and level filters — keeps
working with no change, because a custom spell *is* a spell.

**No persist-version bump.** `version` stays at **6**. Widening a string-literal union is a
type-level change; no persisted document changes shape, and every existing save stays valid
and readable. Bumping would be pure cost. (Stated explicitly because `CLAUDE.md` requires a
bump *when the persisted shape changes* — here it does not.)

**No spell `id`.** Identity across the app is the `name` string: `preparedSpells`,
`racialFreeCastsUsed`, `Resource.itemSpell.name`, `concentration.spellName` and every React
key. Introducing an id for custom spells only would create two identity schemes in one list.
The cost is that names must stay unique and renames must be followed through — both handled
below.

### `DurableSheet` gains one optional field

```ts
export interface DurableSheet {
  // …existing fields…
  /**
   * Spells the player authored in-app. Derived from the tagged entries in
   * `spellbook`/`cantrips` — never a second source of truth. Optional: a device
   * on an older build pushes a sheet without this key, which means "I know
   * nothing about custom spells", NOT "delete them".
   */
  customSpells?: { spellbook: Spell[]; cantrips: Cantrip[] };
}
```

`extractDurable` derives it, so the tagged entries in the character remain the single source
of truth:

```ts
customSpells: {
  spellbook: c.spellbook.filter((s) => s.source === "custom"),
  cantrips: c.cantrips.filter((s) => s.source === "custom"),
},
```

`applyDurable` replaces **only** the custom entries, and only when the remote knows about
them:

```ts
// A remote sheet with no `customSpells` key comes from an older build. Taking it
// verbatim would silently delete every custom spell on every device — the same
// trap `applyRemotePurse` already guards against for magic items.
spellbook: d.customSpells
  ? [...c.spellbook.filter((s) => s.source !== "custom"), ...d.customSpells.spellbook]
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  : c.spellbook,
```

and the same for `cantrips`, sorted by name. Library entries are never touched by a sync.

A `preparedSpells` name left dangling by a remote delete is **accepted, not pruned**: every
consumer derives from `spellbook` and filters by membership, so a name with no spell behind
it renders nowhere. Pruning during a transient apply risks unpreparing a real spell.

### Nothing in `sync.ts` changes

`payloadFor` already sends `extractDurable(character)`; the store subscription already
recomputes `digestState` and debounce-pushes on any `useCharacter` change. Adding a custom
spell flips `dirty` and uploads on the existing 1500 ms debounce, for free.

## Surviving Ficha

`loadCharacter` replaces the character wholesale. It gains a carry-over:

```ts
loadCharacter: (c, opts) => set((s) => {
  const nextId = opts && "sourceId" in opts ? opts.sourceId ?? null : "custom";
  // Carry the player's own spells across a reload of the SAME character only.
  // Switching Lyari → Brunella must never hand Brunella someone else's Fireball.
  const carry = nextId === s.activeCharacterId;
  …
});
```

When `carry` is true, the customs extracted from the outgoing character are appended to the
incoming lists — **skipping any whose name the incoming sheet already has**, case-insensitively.
That is what makes manual promotion work: once Fireball is committed to `lyari.json`, the
next reload keeps the library's copy and drops the duplicate custom, with no user action.

**Known limitation:** an XML/JSON import sets `activeCharacterId` to `"custom"`, so if the
active character was `lyari` the ids differ and customs are **not** carried. This is
deliberate — an import is an unknown sheet and may be a different character entirely. The
recovery path exists: the customs are still in the cloud, and `Traer` restores them.

## Behaviour

### Adding

A **`+ Add spell`** button in the `Spellbook` view header opens a form. Page copy is
English, matching every other label on that screen.

| Field | Required | Notes |
|---|---|---|
| Name | yes | Trimmed. Rejected if it collides (case-insensitive) with any name already in `spellbook`, `cantrips` or `innateSpells`. |
| Level | yes | `Cantrip` or 1–9. **Level decides the destination list**: cantrip → `cantrips`, else → `spellbook`. |
| School | yes | The eight schools, from the existing `SpellSchool` union. |
| Casting time, Range, Components, Duration | no | Free text, as the imported spells already are. |
| Ritual, Concentration | no | Checkboxes. Hidden for cantrips — neither is meaningful at level 0, and `Cantrip` has no such fields. |
| Description | no | Textarea. Optional on purpose: typing full rules text on a phone mid-session is not something to require. |

The name collision is a **hard block with an inline message**, not a silent merge. Name is
the identity key everywhere; two spells sharing one would make `togglePrepared`,
`findSpell` and concentration ambiguous.

The new spell is saved with `source: "custom"` and is **not** auto-prepared — preparing is a
separate, existing gesture, and a scroll copied into the book is not prepared by copying it.

### Editing and deleting

A custom spell's `SpellCard` carries two extra affordances, rendered only when
`source === "custom"`:

- **Edit** — reopens the same form, pre-filled. Every field is editable, including level,
  which may move the spell between `cantrips` and `spellbook`.
- **Delete** — a **two-step inline confirm on the button itself** (`Delete` → `Sure?`,
  reverting after a few seconds), not a modal dialog. The user has already rejected a
  confirm dialog on a destructive action elsewhere; this keeps the safety without the
  interruption, and a hand-typed description is real work to lose.

Custom spells are marked in the list with a small **`Custom`** chip beside the name, so it
is obvious which spells she can touch and which came from the library.

### Rename follow-through

Renaming is where name-as-identity bites. `updateCustomSpell(originalName, patch)` must, in
the same set:

1. rewrite the entry in its list;
2. replace `originalName` in `preparedSpells` if present, preserving preparation;
3. rewrite `concentration.spellName` if she is concentrating on the renamed spell;
4. re-run the collision check against the new name.

Deleting must symmetrically remove the name from `preparedSpells` and drop `concentration`
if it names the deleted spell.

`Resource.itemSpell.name` is **not** rewritten: item-bound spells are authored in the
character JSON against library spells, and a custom spell is not reachable that way. If that
ever changes it becomes a real dangling reference — noted rather than pre-solved.

### The store actions refuse non-custom spells

`updateCustomSpell` and `removeCustomSpell` no-op when the named spell is missing or its
`source` is not `"custom"`. The UI already hides the controls; the guard is what makes
"library spells are untouchable" a property of the model rather than of the rendering.

## Testing

**Unit — `src/lib/durableSheet.test.ts`** (extending):
- `extractDurable` picks up custom spells and custom cantrips, and **excludes** library ones;
- `applyDurable` with `customSpells` **absent** leaves local customs intact — the older-build
  guard, the one that silently deletes data if it regresses;
- `applyDurable` with `customSpells` present replaces the customs, **preserves every library
  entry**, and keeps the result sorted;
- volatile state (current HP, slots, concentration) still survives, as it does today.

**Unit — `src/store/character.test.ts`** (extending, using the existing `makeChar` factory):
- adding a level-0 spell lands in `cantrips`, a leveled one in `spellbook`, both tagged;
- adding a duplicate name is rejected — including against `innateSpells` and with different
  casing;
- renaming a prepared custom spell keeps it prepared and follows the concentration state;
- deleting removes it from `preparedSpells` and drops concentration when it matches;
- `updateCustomSpell` / `removeCustomSpell` refuse a library spell;
- `loadCharacter` **carries** customs when `sourceId` matches `activeCharacterId`, **drops**
  them when it differs, and **skips** a custom whose name the incoming sheet now has.

**Component, jsdom — the form** (new test file): required fields block submission, the
duplicate-name message appears, ritual/concentration are hidden for a cantrip, and a
submitted spell reaches the store in the right list.

**Manual, headless Chrome** via `$TEMP/uitest/shootp.mjs` with a persistent profile: add a
spell, confirm the `Custom` chip and that it is searchable and preparable; then reload the
character from the library and confirm it is still there — the survival claim spans two
boots, which is exactly what the persistent-profile harness exists for. Remember to
navigate to `about:blank` before the screenshot so late `localStorage` writes flush.

**Not covered by tests, stated plainly:** the cross-device round trip. Local dev writes to
**production** Upstash, so it will be exercised with sync disabled or against a throwaway
character id, never by pushing real data from a test.

## Risks

- **Name identity.** Mitigated by the collision block and the rename follow-through, but it
  stays the sharpest edge in this design. An id scheme is the escape hatch if it ever bites.
- **Payload growth.** A full description is a few KB and the sheet travels whole on every
  debounced push. Ten custom spells is still small; a hundred would not be, and nothing here
  enforces a limit. Accepted, and worth watching rather than pre-optimising.
- **Typing at the table.** The form is the price of not shipping a catalog. Every field but
  name, level and school is optional precisely so a spell can be added in fifteen seconds and
  fleshed out later.
- **The import gap.** Re-importing an XML drops customs (see above). The user's normal path
  is the library, not re-import, and `Traer` recovers.

## Open questions

None. Scope (add + edit + delete, spellbook + cantrips, no innate), the data source (typed by
hand), and the survival model (custom-tagged, cloud-held, re-applied over a library reload)
were all settled in the brainstorm.
