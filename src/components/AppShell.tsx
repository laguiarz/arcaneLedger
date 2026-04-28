import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { useCharacter } from "@/store/character";
import Icon from "./ui/Icon";
import RestMenu from "./RestMenu";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: "auto_awesome_motion" },
  { to: "/encounter", label: "Encounter", icon: "swords" },
  { to: "/spellbook", label: "Spellbook", icon: "menu_book" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

const SIDEBAR_PREF_KEY = "al.sidebar.expanded";

export default function AppShell() {
  const c = useCharacter((s) => s.character);
  const [restOpen, setRestOpen] = useState(false);
  const [expanded, setExpanded] = useState<boolean>(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(SIDEBAR_PREF_KEY) : null;
    return stored === "1";
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_PREF_KEY, expanded ? "1" : "0");
  }, [expanded]);

  const lowestSlot = (() => {
    const lvls = (Object.keys(c.spellSlots) as unknown as number[])
      .map((k) => Number(k))
      .filter((lvl) => (c.spellSlots[lvl as 1] ?? 0) > 0)
      .sort((a, b) => a - b);
    return lvls[0];
  })();

  const totalSlotsAvail = Object.values(c.spellSlots).reduce<number>((a, b) => a + (b ?? 0), 0);
  const totalSlotsMax = Object.values(c.spellSlotsMax).reduce<number>((a, b) => a + (b ?? 0), 0);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={[
          "hidden md:flex flex-col bg-surface-container-low border-r border-amber-900/40 shadow-[inset_-10px_0_30px_rgba(0,0,0,0.4)] transition-[width] duration-200 ease-out",
          expanded ? "w-64" : "w-16",
        ].join(" ")}
      >
        <div
          className={[
            "border-b border-amber-900/30 flex",
            expanded ? "px-md pt-md pb-sm flex-col" : "px-2 pt-2 pb-2 items-center justify-center",
          ].join(" ")}
        >
          {expanded ? (
            <>
              <h1 className="font-serif font-bold tracking-widest uppercase text-primary text-xl leading-tight">
                Arcanist's
              </h1>
              <h1 className="font-serif font-bold tracking-widest uppercase text-primary text-xl leading-tight">
                Ledger
              </h1>
              <div className="mt-sm flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-serif text-title-sm text-on-surface leading-tight truncate">{c.name}</p>
                  <p className="text-xs text-outline uppercase tracking-wider mt-1">
                    Level {c.level} {c.className}
                  </p>
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="btn-icon shrink-0"
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  <Icon name="chevron_left" />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setExpanded(true)}
              className="btn-icon"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <Icon name="chevron_right" />
            </button>
          )}
        </div>

        <nav className={["flex-1 py-md space-y-1", expanded ? "px-2" : "px-2 flex flex-col items-center"].join(" ")}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={expanded ? undefined : item.label}
              aria-label={item.label}
              className={({ isActive }) =>
                expanded
                  ? [
                      "flex items-center gap-3 px-sm py-2.5 rounded-md transition-all",
                      isActive
                        ? "bg-surface-container text-primary border-l-4 border-primary shadow-[0_0_15px_rgba(46,58,89,0.4)]"
                        : "text-outline border-l-4 border-transparent hover:text-on-surface hover:bg-surface-container/60",
                    ].join(" ")
                  : [
                      "flex items-center justify-center w-10 h-10 rounded-md transition-all",
                      isActive
                        ? "bg-surface-container text-primary border border-primary/60 shadow-[0_0_15px_rgba(46,58,89,0.4)]"
                        : "text-outline border border-transparent hover:text-on-surface hover:bg-surface-container/60 hover:border-outline-variant/40",
                    ].join(" ")
              }
            >
              <Icon name={item.icon} filled={!expanded} />
              {expanded && <span className="font-serif text-sm">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div
          className={[
            "border-t border-amber-900/30 space-y-2",
            expanded ? "p-md" : "p-2 flex flex-col items-center",
          ].join(" ")}
        >
          {expanded ? (
            <button onClick={() => setRestOpen(true)} className="btn-brass w-full">
              <Icon name="bedtime" filled /> Rest
            </button>
          ) : (
            <button
              onClick={() => setRestOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-md bg-primary-container text-on-primary-container border border-primary/40 shadow-[0_0_0_1px_rgba(233,193,118,0.15),0_2px_0_rgba(0,0,0,0.4)] hover:brightness-110 active:scale-95 transition"
              aria-label="Rest"
              title="Rest"
            >
              <Icon name="bedtime" filled />
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b border-amber-900/30 bg-surface-container-lowest/80 backdrop-blur shadow-[0_2px_10px_rgba(0,0,0,0.4)] flex items-center justify-between px-md">
          <div className="md:hidden flex items-center gap-2">
            <Icon name="auto_stories" className="text-primary" />
            <span className="font-serif font-bold tracking-widest uppercase text-primary">Arcanist's Ledger</span>
          </div>
          <div className="hidden md:block" />

          <div className="flex items-center gap-sm">
            <Pill icon="favorite" tone="error" label={`${c.hp.current}${c.hp.temp ? `+${c.hp.temp}` : ""}/${c.hp.max} HP`} />
            <Pill
              icon="bolt"
              tone="primary"
              label={
                totalSlotsMax > 0
                  ? `${totalSlotsAvail}/${totalSlotsMax} slots${lowestSlot ? ` · L${lowestSlot}+` : ""}`
                  : "No slots"
              }
            />
            {c.conditions.active.length + (c.conditions.exhaustion > 0 ? 1 : 0) > 0 && (
              <Pill
                icon="warning"
                tone="error"
                label={`${c.conditions.active.length + (c.conditions.exhaustion > 0 ? 1 : 0)} conditions`}
              />
            )}
            <button
              onClick={() => setRestOpen(true)}
              className="md:hidden btn-icon"
              aria-label="Rest"
            >
              <Icon name="bedtime" filled />
            </button>
          </div>
        </header>

        {/* Mobile bottom nav */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-lowest border-t border-amber-900/40 flex justify-around items-center z-40">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "flex flex-col items-center gap-1 px-3 py-1",
                  isActive ? "text-primary" : "text-outline",
                ].join(" ")
              }
            >
              <Icon name={item.icon} filled />
              <span className="text-[10px] uppercase tracking-wider font-bold">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <RestMenu open={restOpen} onClose={() => setRestOpen(false)} />
    </div>
  );
}

function Pill({
  icon,
  label,
  tone = "primary",
}: {
  icon: string;
  label: string;
  tone?: "primary" | "error" | "secondary";
}) {
  const tones: Record<string, string> = {
    primary: "text-primary border-primary/30 bg-primary/5",
    error: "text-error border-error/30 bg-error/5",
    secondary: "text-secondary border-secondary/30 bg-secondary/5",
  };
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${tones[tone]} text-xs font-bold tracking-wider`}
    >
      <Icon name={icon} filled size={16} />
      <span>{label}</span>
    </div>
  );
}
