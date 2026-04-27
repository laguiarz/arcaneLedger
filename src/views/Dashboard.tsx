import { useCharacter } from "@/store/character";
import HpPanel from "@/components/panels/HpPanel";
import SlotsPanel from "@/components/panels/SlotsPanel";
import SavesPanel from "@/components/panels/SavesPanel";
import ConditionsPanel from "@/components/panels/ConditionsPanel";
import ResourcesPanel from "@/components/panels/ResourcesPanel";
import SectionHeader from "@/components/ui/SectionHeader";

export default function Dashboard() {
  const c = useCharacter((s) => s.character);

  return (
    <div className="max-w-6xl mx-auto p-md md:p-lg space-y-lg">
      <header className="flex items-end justify-between">
        <div>
          <p className="label-caps text-outline">Companion Ledger</p>
          <h1 className="font-serif text-display-lg text-primary leading-none">{c.name}</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Level {c.level} {c.className}
            {c.subclass ? ` · ${c.subclass}` : ""}
          </p>
        </div>
        <div className="hidden md:flex flex-col items-end text-xs text-outline">
          {c.ac != null && (
            <span>
              AC <span className="text-primary font-bold">{c.ac}</span>
            </span>
          )}
          {c.speed != null && (
            <span>
              Speed <span className="text-primary font-bold">{c.speed} ft</span>
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-md items-start">
        <div className="md:col-span-4">
          <HpPanel />
        </div>

        <div className="md:col-span-8 space-y-md">
          <section>
            <SectionHeader icon="bolt" title="Spell Slot Reservoirs" subtitle="Tap a pip to spend or recover" />
            <SlotsPanel />
          </section>

          <SavesPanel />
        </div>
      </div>

      <section>
        <SectionHeader icon="warning" title="Conditions" />
        <ConditionsPanel />
      </section>

      <section>
        <SectionHeader icon="inventory_2" title="Abilities & Items" subtitle="Limited-use features, feats, magic items" />
        <ResourcesPanel />
      </section>
    </div>
  );
}
