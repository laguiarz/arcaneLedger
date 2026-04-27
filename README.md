# Arcanist's Ledger

In-session companion for D&D 5e (2024 PHB). Built around the workflow of playing at the table with **physical dice** — the app surfaces what your character can *do* on each turn (cantrips, spells, resources, action-economy reminders) and tracks the pools that matter (HP, slots, hit dice, concentration, conditions). It is intentionally **not** a character builder yet — that's Phase 2.

Personal project, single PC for now (Lyari, Wizard / School of Illusion, currently L5).

## Stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind** (custom theme: leather / brass / parchment palette)
- **Zustand** with the `persist` middleware (localStorage, versioned)
- No backend — everything is client-side

## What it does

- **Import**: parses Fight Club 5e / Game Master 5e XML exports and JSON snapshots (Settings → Import).
- **Export**: download character JSON or copy to clipboard. **This is the canonical save format** — once seeded from FC5 XML, work from the JSON; only re-import XML to reset.
- **Encounter view**: compact rows for spells, cantrips, resources — optimized for a single tap during a turn.
- **Spellbook**: full cards with cast / upcast picker, prepare toggle, ritual support.
- **Resources panel**: tracks limited-use abilities (slots, hit dice, racial / feat / subclass features). At-will or passive abilities are stored as `max: 0, recharge: "manual"` reminders.
- **Concentration tracker**, **conditions / exhaustion**, **rest menu** (long / short).
- **Manual roll input**: the user rolls real dice — the app never auto-rolls.

## Knowledge registries

Two registries bridge the gap between FC5's prose-only feat / subclass blobs and the structured data the app needs:

- **`src/lib/featRegistry.ts`** — keyed by lowercased feat name. Currently covers Telekinetic (INT/WIS/CHA variants).
- **`src/lib/subclassRegistry.ts`** — keyed by `${className}:${subclass}` (lowercased). Currently covers Wizard 2024 Illusionist L3 (Improved Illusions): per-name `modifyCantrip` patches, `schoolModifiers` (school-wide rules), and passive `Resource` reminders. See [`SUBCLASS_FEATURES_DESIGN.md`](./SUBCLASS_FEATURES_DESIGN.md) for the design doc and roadmap (Evoker, Diviner, Abjurer in later phases).

Modifications are rendered **transparently** so RAW stays auditable: range bonuses appear as `"30 + 60 feet"` (not `"90 feet"`), and stripped components are shown struck-through (not removed).

## Dev

```bash
npm install
npm run dev        # Vite dev server
npm run build      # tsc -b + production bundle
npm run typecheck  # tsc --noEmit
```

## Project layout

```
src/
  components/        UI components (AppShell, SpellCard, panels, encounter rows, ui primitives)
  views/             Top-level routes (Dashboard, Encounter, Spellbook, Settings)
  lib/               Pure logic (importer, registries, constants)
  store/             Zustand store + persistence
  types/             Character / Spell / Resource type definitions
data/                Sample FC5 XML (Lyari Mistweaver)
mockups/             Early UI mockups + design notes
SUBCLASS_FEATURES_DESIGN.md   Phased plan for subclass support
```

## Status

- ✅ Core in-session loop: spells, cantrips, slots, resources, rest, concentration, conditions
- ✅ FC5 XML / JSON import + JSON export
- ✅ Feat registry (Telekinetic)
- ✅ Subclass registry — Phase 1: Wizard Illusionist L3
- ⏳ Subclass registry — Phase 2: Evoker + Diviner (`Character.portent` shape)
- ⏳ Subclass registry — Phase 3: Abjurer (`Character.ward` shape)
- ⏳ Phase 2 builder — UI for editing / leveling-up / spellbook management
