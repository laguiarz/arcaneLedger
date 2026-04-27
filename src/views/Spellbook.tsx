import { useMemo, useState } from "react";
import { useCharacter, preparedNonRituals } from "@/store/character";
import SectionHeader from "@/components/ui/SectionHeader";
import SlotsPanel from "@/components/panels/SlotsPanel";
import SpellCard, { CantripCard } from "@/components/SpellCard";
import Icon from "@/components/ui/Icon";
import type { Spell } from "@/types/character";

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

  const prepared = useMemo(() => preparedNonRituals(c), [c]);
  const ritualsAvail = useMemo(() => {
    // Wizards can cast any ritual from their spellbook even unprepared.
    // Prepared rituals are also castable as rituals (additional option).
    return c.spellbook.filter((s) => s.ritual);
  }, [c]);

  const allSorted = useMemo(
    () =>
      [...c.spellbook].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
    [c.spellbook],
  );

  const filterFn = <T extends { name: string; school: string }>(s: T) =>
    !query ||
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.school.toLowerCase().includes(query.toLowerCase());

  return (
    <div className="max-w-7xl mx-auto p-md md:p-lg space-y-lg">
      <SectionHeader
        icon="bolt"
        title="Spell Slot Reservoirs"
        subtitle={`${c.name} · DC ${(8 + c.proficiencyBonus + Math.floor((c.abilities.int - 10) / 2))} · Atk +${c.proficiencyBonus + Math.floor((c.abilities.int - 10) / 2)}`}
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

      {tab === "prepared" && (
        <div className="space-y-md">
          <SectionHeader icon="star" title="Prepared Incantations" />
          {prepared.length === 0 && (
            <EmptyState text="No spells prepared. Open Spellbook tab to prepare some." />
          )}
          {groupByLevel(prepared.filter(filterFn)).map(([lvl, spells]) => (
            <LevelGroup key={lvl} level={lvl}>
              {spells.map((s) => (
                <SpellCard key={s.name} spell={s} />
              ))}
            </LevelGroup>
          ))}
        </div>
      )}

      {tab === "cantrips" && (
        <div className="space-y-sm">
          <SectionHeader icon="flash_on" title="Cantrips" subtitle="Always available, no slot cost" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
            {c.cantrips.filter(filterFn).map((s) => (
              <CantripCard key={s.name} spell={s} />
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
            subtitle="Wizards can cast any ritual from the spellbook (+10 min, no slot)"
          />
          {ritualsAvail.length === 0 && <EmptyState text="No rituals in spellbook." />}
          {groupByLevel(ritualsAvail.filter(filterFn)).map(([lvl, spells]) => (
            <LevelGroup key={lvl} level={lvl}>
              {spells.map((s) => (
                <SpellCard key={s.name} spell={s} ritualMode />
              ))}
            </LevelGroup>
          ))}
        </div>
      )}

      {tab === "all" && (
        <div className="space-y-md">
          <SectionHeader
            icon="menu_book"
            title="Full Spellbook"
            subtitle="Tap the star to prepare or unprepare"
          />
          {groupByLevel(allSorted.filter(filterFn)).map(([lvl, spells]) => (
            <LevelGroup key={lvl} level={lvl}>
              {spells.map((s) => (
                <SpellCard key={s.name} spell={s} showPrepareToggle />
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
