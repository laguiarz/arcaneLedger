import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { useCombat, type NewCombatantInput } from "@/store/combat";
import { abilityMod, useCharacter } from "@/store/character";

/**
 * Combat setup. The party is stored on the active character's sheet (a list of
 * member names) so it persists between sessions; "Add party to combat" drops the
 * active character plus every saved member into the initiative table. Monsters
 * are added ad-hoc with optional initiative / HP / AC.
 */
export default function AddCombatantForm() {
  const character = useCharacter((s) => s.character);
  const activeCharacterId = useCharacter((s) => s.activeCharacterId);
  const setParty = useCharacter((s) => s.setParty);

  const combatants = useCombat((s) => s.combatants);
  const addCombatants = useCombat((s) => s.addCombatants);
  const addCombatant = useCombat((s) => s.addCombatant);

  const party = character.party ?? [];

  const [newMember, setNewMember] = useState("");
  const [partyMsg, setPartyMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [init, setInit] = useState("");
  const [hp, setHp] = useState("");
  const [ac, setAc] = useState("");

  const addMember = () => {
    const n = newMember.trim();
    if (!n) return;
    if (party.some((m) => m.toLowerCase() === n.toLowerCase())) {
      setPartyMsg(`${n} is already in the party.`);
      return;
    }
    setParty([...party, n]);
    setNewMember("");
    setPartyMsg(null);
  };

  const removeMember = (member: string) => {
    setParty(party.filter((m) => m !== member));
  };

  const addPartyToCombat = () => {
    setPartyMsg(null);
    const present = new Set(combatants.map((c) => c.name.toLowerCase()));
    // The active character leads the line; the saved members follow.
    const roster = [character.name, ...party];
    const inputs: NewCombatantInput[] = roster
      .filter((n) => n.trim() && !present.has(n.toLowerCase()))
      .map((n) => {
        const isActive = n === character.name;
        return {
          name: n,
          kind: "pc",
          initiative: null,
          initiativeBonus: isActive
            ? character.initiativeBonus ?? abilityMod(character.abilities.dex)
            : undefined,
          sourceId: isActive ? activeCharacterId ?? undefined : undefined,
        };
      });
    if (inputs.length === 0) {
      setPartyMsg("Everyone is already in the fight.");
      return;
    }
    addCombatants(inputs);
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
    <div className="bg-surface-container border border-amber-900/30 rounded-lg p-sm space-y-md">
      {/* Party (persisted on the character sheet) */}
      <div className="space-y-sm">
        <div className="flex items-center justify-between gap-sm flex-wrap">
          <span className="label-caps text-primary">Party — {character.name}</span>
          <button className="btn-ghost !py-1" onClick={addPartyToCombat}>
            <Icon name="groups" filled /> Add party to combat
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* The active character is always part of the line-up. */}
          <span className="inline-flex items-center gap-1 text-xs bg-secondary/10 border border-secondary/40 text-secondary rounded-full px-2 py-1">
            <Icon name="person" size={14} filled />
            {character.name}
            <span className="text-[10px] uppercase tracking-wider opacity-70">you</span>
          </span>
          {party.map((member) => (
            <span
              key={member}
              className="inline-flex items-center gap-1 text-xs bg-surface-container-low border border-outline-variant/40 text-on-surface rounded-full px-2 py-1"
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
          {party.length === 0 && (
            <span className="text-xs text-outline italic">
              No party members yet — add the names below.
            </span>
          )}
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
        {partyMsg && (
          <p className="text-xs text-outline italic">{partyMsg}</p>
        )}
      </div>

      <div className="h-px bg-outline-variant/30" />

      {/* Monsters / villains (ad-hoc, not persisted) */}
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
