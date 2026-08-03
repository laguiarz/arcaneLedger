import { useMemo, useState } from "react";
import {
  useCharacter,
  preparedNonRituals,
  availableRituals,
  ritualsNeedingPreparation,
  spellSaveDc,
  spellAttackBonus,
} from "@/store/character";
import SectionHeader from "@/components/ui/SectionHeader";
import SlotsPanel from "@/components/panels/SlotsPanel";
import SpellCard, { CantripCard } from "@/components/SpellCard";
import Icon from "@/components/ui/Icon";
import SpellForm from "@/components/spells/SpellForm";
import type { Cantrip, Spell } from "@/types/character";

type Tab = "prepared" | "cantrips" | "rituals" | "all";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "prepared", label: "Prepared", icon: "star" },
  { id: "cantrips", label: "Cantrips", icon: "flash_on" },
  { id: "rituals", label: "Rituals", icon: "auto_stories" },
  { id: "all", label: "Spellbook", icon: "menu_book" },
];

export default function Spellbook() {
  const c = useCharacter((s) => s.character);
  const [tab, setTab] = useState<Tab>("prepared");
  const [query, setQuery] = useState("");
  const [levels, setLevels] = useState<Set<number>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Spell | Cantrip | null>(null);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: Spell | Cantrip) => {
    setEditing(s);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const toggleLevel = (l: number) =>
    setLevels((prev) => {
      const next = new Set(prev);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      return next;
    });

  const prepared = useMemo(() => preparedNonRituals(c), [c]);
  const ritualsAvail = useMemo(() => availableRituals(c), [c]);
  const ritualsToPrepare = useMemo(() => ritualsNeedingPreparation(c), [c]);

  const allSorted = useMemo(
    () =>
      [...c.spellbook].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
    [c.spellbook],
  );

  const availableLevels = useMemo(() => {
    const set = new Set<number>();
    for (const [lvl, max] of Object.entries(c.spellSlotsMax)) {
      if ((max ?? 0) > 0) set.add(Number(lvl));
    }
    return [...set].sort((a, b) => a - b);
  }, [c.spellSlotsMax]);

  const tabSource: Spell[] =
    tab === "prepared" ? prepared : tab === "rituals" ? ritualsAvail : allSorted;

  const levelCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of tabSource) m.set(s.level, (m.get(s.level) ?? 0) + 1);
    return m;
  }, [tabSource]);

  const matchesSearch = (s: { name: string; school: string }) =>
    !query ||
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.school.toLowerCase().includes(query.toLowerCase());

  const matchesLevel = (s: { level: number }) =>
    levels.size === 0 || levels.has(s.level);

  const spellFilter = (s: Spell) => matchesSearch(s) && matchesLevel(s);

  return (
    <div className="max-w-7xl mx-auto p-md md:p-lg space-y-lg">
      <SectionHeader
        icon="bolt"
        title="Spell Slot Reservoirs"
        subtitle={`${c.name} · DC ${spellSaveDc(c)} · Atk +${spellAttackBonus(c)}`}
      />
      <SlotsPanel />

      <div className="flex flex-wrap items-center gap-sm pt-sm border-t border-outline-variant/30">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            const count =
              t.id === "prepared"
                ? prepared.length
                : t.id === "cantrips"
                  ? c.cantrips.length
                  : t.id === "rituals"
                    ? ritualsAvail.length
                    : c.spellbook.length;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-sm py-2 rounded-md border text-sm font-bold tracking-wide transition ${
                  active
                    ? "bg-primary/15 border-primary text-primary shadow-[0_0_10px_rgba(233,193,118,0.2)]"
                    : "bg-surface-container-low border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:border-primary/40"
                }`}
              >
                <Icon name={t.icon} filled={active} size={16} />
                {t.label}
                <span className="text-outline font-mono text-xs">{count}</span>
              </button>
            );
          })}
        </div>

        {tab !== "cantrips" && availableLevels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="label-caps text-outline mr-1">Level</span>
            {availableLevels.map((l) => {
              const active = levels.has(l);
              const count = levelCounts.get(l) ?? 0;
              const empty = count === 0;
              return (
                <button
                  key={l}
                  onClick={() => toggleLevel(l)}
                  disabled={empty && !active}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-sm font-bold tracking-wide transition ${
                    active
                      ? "bg-primary/15 border-primary text-primary shadow-[0_0_8px_rgba(233,193,118,0.2)]"
                      : empty
                        ? "bg-surface-container-low border-outline-variant/30 text-outline cursor-not-allowed opacity-60"
                        : "bg-surface-container-low border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:border-primary/40"
                  }`}
                  aria-pressed={active}
                  title={`Level ${l}`}
                >
                  {l}
                  <span className="text-outline font-mono text-[10px]">{count}</span>
                </button>
              );
            })}
            {levels.size > 0 && (
              <button
                onClick={() => setLevels(new Set())}
                className="ml-1 text-xs text-outline hover:text-on-surface-variant inline-flex items-center gap-1"
                title="Clear level filters"
              >
                <Icon name="close" size={12} />
                Clear
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-sm py-2 rounded-md border border-primary/40 bg-surface-container-low text-primary text-sm font-bold tracking-wide transition hover:bg-primary/15"
        >
          <Icon name="add" size={16} /> Add spell
        </button>

        <div className="ml-auto relative">
          <Icon name="search" className="absolute left-2 top-2.5 text-outline" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="input-inset pl-8 w-48"
          />
        </div>
      </div>

      {formOpen && <SpellForm editing={editing} onClose={closeForm} />}

      {tab === "prepared" && (
        <div className="space-y-md">
          <SectionHeader icon="star" title="Prepared Incantations" />
          {prepared.length === 0 && (
            <EmptyState text="No spells prepared. Open Spellbook tab to prepare some." />
          )}
          {groupByLevel(prepared.filter(spellFilter)).map(([lvl, spells]) => (
            <LevelGroup key={lvl} level={lvl}>
              {spells.map((s) => (
                <SpellCard key={s.name} spell={s} onEdit={openEdit} />
              ))}
            </LevelGroup>
          ))}
        </div>
      )}

      {tab === "cantrips" && (
        <div className="space-y-sm">
          <SectionHeader icon="flash_on" title="Cantrips" subtitle="Always available, no slot cost" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
            {c.cantrips.filter(matchesSearch).map((s) => (
              <CantripCard key={s.name} spell={s} onEdit={openEdit} />
            ))}
          </div>
          {c.cantrips.length === 0 && <EmptyState text="No cantrips known." />}
        </div>
      )}

      {tab === "rituals" && (
        <div className="space-y-md">
          <SectionHeader
            icon="auto_stories"
            title="Ritual Archive"
            subtitle={
              c.className.trim().toLowerCase() === "wizard"
                ? "Any ritual from the spellbook, plus granted ones (+10 min, no slot)"
                : "Prepared rituals, plus ones granted by lineage, feats and items (+10 min, no slot)"
            }
          />
          {ritualsAvail.length === 0 && ritualsToPrepare.length === 0 && (
            <EmptyState text="No rituals available." />
          )}
          {groupByLevel(ritualsAvail.filter(spellFilter)).map(([lvl, spells]) => (
            <LevelGroup key={lvl} level={lvl}>
              {spells.map((s) => (
                <SpellCard key={s.name} spell={s} ritualMode onEdit={openEdit} />
              ))}
            </LevelGroup>
          ))}

          {/* Without this, a non-Wizard who owns a ritual but has not prepared
              it sees nothing at all on the page named for rituals — which reads
              as the spell having failed to save. */}
          {ritualsToPrepare.length > 0 && (
            <div className="space-y-md pt-md border-t border-outline-variant/30">
              <SectionHeader
                icon="star_border"
                title="Needs preparing"
                subtitle="Rituals in the spellbook. Tap the star to prepare one, then it can be ritual-cast."
              />
              {groupByLevel(ritualsToPrepare.filter(spellFilter)).map(([lvl, spells]) => (
                <LevelGroup key={lvl} level={lvl}>
                  {spells.map((s) => (
                    <SpellCard key={s.name} spell={s} showPrepareToggle onEdit={openEdit} />
                  ))}
                </LevelGroup>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "all" && (
        <div className="space-y-md">
          <SectionHeader
            icon="menu_book"
            title="Full Spellbook"
            subtitle="Tap the star to prepare or unprepare"
          />
          {groupByLevel(allSorted.filter(spellFilter)).map(([lvl, spells]) => (
            <LevelGroup key={lvl} level={lvl}>
              {spells.map((s) => (
                <SpellCard key={s.name} spell={s} showPrepareToggle onEdit={openEdit} />
              ))}
            </LevelGroup>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByLevel(spells: Spell[]): [number, Spell[]][] {
  const map = new Map<number, Spell[]>();
  for (const s of spells) {
    const arr = map.get(s.level) ?? [];
    arr.push(s);
    map.set(s.level, arr);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

function LevelGroup({ level, children }: { level: number; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="label-caps text-outline mb-2 flex items-center gap-2">
        <span className="h-px flex-1 bg-outline-variant/40" />
        Level {level}
        <span className="h-px flex-1 bg-outline-variant/40" />
      </h3>
      <div className="space-y-sm">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-md text-outline italic text-sm border border-dashed border-outline-variant/40 rounded-lg">
      {text}
    </div>
  );
}
