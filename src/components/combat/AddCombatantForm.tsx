import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { useCombat, type NewCombatantInput } from "@/store/combat";
import { abilityMod } from "@/store/character";
import {
  fetchLibraryCharacter,
  fetchLibraryManifest,
} from "@/lib/characterLibrary";

/**
 * Combat setup: pull the whole party from the cloud library in one click, and
 * add monsters/villains by hand. Party members already in the fight (matched by
 * library id) are skipped so re-clicking never duplicates them.
 */
export default function AddCombatantForm() {
  const combatants = useCombat((s) => s.combatants);
  const addCombatants = useCombat((s) => s.addCombatants);
  const addCombatant = useCombat((s) => s.addCombatant);

  const [loadingParty, setLoadingParty] = useState(false);
  const [partyError, setPartyError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [init, setInit] = useState("");
  const [hp, setHp] = useState("");
  const [ac, setAc] = useState("");

  const loadParty = async () => {
    setLoadingParty(true);
    setPartyError(null);
    try {
      const summaries = await fetchLibraryManifest();
      const present = new Set(
        combatants.map((c) => c.sourceId).filter(Boolean) as string[],
      );
      const toFetch = summaries.filter((s) => !present.has(s.id));
      // Parallel fetch — no sequential N+1 over the network.
      const chars = await Promise.all(
        toFetch.map((s) =>
          fetchLibraryCharacter(s.id).then((c) => ({ summary: s, char: c })),
        ),
      );
      const inputs: NewCombatantInput[] = chars.map(({ summary, char }) => ({
        name: char.name,
        kind: "pc",
        initiative: null,
        initiativeBonus: char.initiativeBonus ?? abilityMod(char.abilities.dex),
        ac: char.ac,
        sourceId: summary.id,
      }));
      if (inputs.length === 0) {
        setPartyError("The whole party is already in the fight.");
      } else {
        addCombatants(inputs);
      }
    } catch (e) {
      setPartyError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingParty(false);
    }
  };

  const addMonster = () => {
    if (!name.trim()) return;
    const maxHp = hp ? Math.max(1, Number(hp)) : undefined;
    addCombatant({
      name,
      kind: "monster",
      initiative: init === "" ? null : Number(init),
      hp: maxHp != null ? { current: maxHp, max: maxHp } : undefined,
      ac: ac === "" ? undefined : Number(ac),
    });
    setName("");
    setInit("");
    setHp("");
    setAc("");
  };

  return (
    <div className="bg-surface-container border border-amber-900/30 rounded-lg p-sm space-y-sm">
      <div className="flex items-center justify-between gap-sm flex-wrap">
        <span className="label-caps text-primary">Setup</span>
        <button
          className="btn-ghost !py-1"
          onClick={() => void loadParty()}
          disabled={loadingParty}
        >
          <Icon name={loadingParty ? "hourglass_top" : "groups"} filled />
          {loadingParty ? "Loading party…" : "Load party"}
        </button>
      </div>

      {partyError && (
        <p className="text-xs text-error border border-error/40 bg-error/10 rounded-md px-2 py-1">
          {partyError}
        </p>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addMonster();
        }}
      >
        <Field label="Monster / villain" className="flex-1 min-w-[10rem]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Gelatinous Cube"
            className="input-inset w-full text-sm"
          />
        </Field>
        <Field label="Init">
          <input
            type="number"
            value={init}
            onChange={(e) => setInit(e.target.value)}
            placeholder="—"
            className="input-inset w-16 text-center font-mono text-sm"
          />
        </Field>
        <Field label="HP">
          <input
            type="number"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            placeholder="—"
            className="input-inset w-16 text-center font-mono text-sm"
          />
        </Field>
        <Field label="AC">
          <input
            type="number"
            value={ac}
            onChange={(e) => setAc(e.target.value)}
            placeholder="—"
            className="input-inset w-16 text-center font-mono text-sm"
          />
        </Field>
        <button type="submit" className="btn-brass" disabled={!name.trim()}>
          <Icon name="add" /> Add
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="label-caps text-outline text-[10px]">{label}</span>
      {children}
    </label>
  );
}
