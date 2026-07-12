import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { useCombat } from "@/store/combat";
import { useCharacter } from "@/store/character";

/**
 * Secondary combat setup, kept below the round table since it's touched rarely.
 * The party roster lives on the character sheet (persisted); editing it here
 * also adds/removes the matching combatant live. Monsters are added ad-hoc.
 */
export default function AddCombatantForm() {
  const character = useCharacter((s) => s.character);
  const setParty = useCharacter((s) => s.setParty);

  const combatants = useCombat((s) => s.combatants);
  const addCombatant = useCombat((s) => s.addCombatant);
  const removeCombatant = useCombat((s) => s.removeCombatant);

  const party = character.party ?? [];

  const [newMember, setNewMember] = useState("");
  const [name, setName] = useState("");
  const [init, setInit] = useState("");
  const [hp, setHp] = useState("");
  const [ac, setAc] = useState("");

  const addMember = () => {
    const n = newMember.trim();
    if (!n) return;
    if (!party.some((m) => m.toLowerCase() === n.toLowerCase())) {
      setParty([...party, n]);
    }
    // Drop them into the live fight too, unless already there.
    if (!combatants.some((c) => c.name.toLowerCase() === n.toLowerCase())) {
      addCombatant({ name: n, kind: "pc", initiative: null });
    }
    setNewMember("");
  };

  const removeMember = (member: string) => {
    setParty(party.filter((m) => m !== member));
    const inFight = combatants.find((c) => c.name === member);
    if (inFight) removeCombatant(inFight.id);
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
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-sm space-y-md">
      {/* Add monster — the most common setup action, so it goes first here. */}
      <div className="space-y-sm">
        <span className="label-caps text-primary">Add monster / villain</span>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addMonster();
          }}
        >
          <Field label="Name" className="flex-1 min-w-[10rem]">
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

      <div className="h-px bg-outline-variant/30" />

      {/* Party roster — persisted on the sheet, rarely edited mid-session. */}
      <div className="space-y-sm">
        <span className="label-caps text-outline">
          Party roster — saved on {character.name}&apos;s sheet
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs bg-secondary/10 border border-secondary/40 text-secondary rounded-full px-2 py-1">
            <Icon name="person" size={14} filled />
            {character.name}
            <span className="text-[10px] uppercase tracking-wider opacity-70">you</span>
          </span>
          {party.map((member) => (
            <span
              key={member}
              className="inline-flex items-center gap-1 text-xs bg-surface-container border border-outline-variant/40 text-on-surface rounded-full px-2 py-1"
            >
              <Icon name="person" size={14} />
              {member}
              <button
                onClick={() => removeMember(member)}
                aria-label={`Remove ${member} from party`}
                className="text-outline hover:text-error active:scale-90 transition"
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addMember();
          }}
        >
          <input
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            placeholder="Add a party member's name"
            className="input-inset flex-1 min-w-[10rem] text-sm"
          />
          <button type="submit" className="btn-ghost !py-1.5" disabled={!newMember.trim()}>
            <Icon name="person_add" /> Add member
          </button>
        </form>
      </div>
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
