import { useCharacter } from "@/store/character";
import { armorClass } from "@/lib/armor";
import HpPanel from "@/components/panels/HpPanel";
import AcPanel from "@/components/panels/AcPanel";
import AttacksPanel from "@/components/panels/AttacksPanel";
import AbilitiesPanel from "@/components/panels/AbilitiesPanel";
import SavesPanel from "@/components/panels/SavesPanel";
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
          <span>
            AC <span className="text-primary font-bold">{armorClass(c)}</span>
          </span>
          {c.speed != null && (
            <span>
              Speed <span className="text-primary font-bold">{c.speed} ft</span>
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-md items-start">
        <div className="md:col-span-4 space-y-md">
          <HpPanel />
          <AcPanel />
          <AttacksPanel />
        </div>

        <div className="md:col-span-8 space-y-md">
          <AbilitiesPanel />
          <SavesPanel />
        </div>
      </div>

      <section>
        <SectionHeader icon="inventory_2" title="Abilities & Items" subtitle="Limited-use features, feats, magic items" />
        <ResourcesPanel />
      </section>
    </div>
  );
}
