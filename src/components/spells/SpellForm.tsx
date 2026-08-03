import { useState } from "react";
import { useCharacter } from "@/store/character";
import { SPELL_LEVELS, SPELL_SCHOOLS } from "@/lib/constants";
import type { CustomSpellDraft } from "@/lib/customSpells";
import type { Cantrip, Spell, SpellLevel, SpellSchool } from "@/types/character";
import Icon from "@/components/ui/Icon";

interface Props {
  /** The spell being edited, or null to add a new one. */
  editing: Spell | Cantrip | null;
  onClose: () => void;
}

function initialDraft(editing: Spell | Cantrip | null): CustomSpellDraft {
  if (!editing) return { name: "", level: 1, school: "Evocation" };
  // Cantrips have no `level` field at all — that is how the two are told apart.
  const leveled = "level" in editing ? (editing as Spell) : null;
  return {
    name: editing.name,
    level: leveled ? leveled.level : 0,
    school: editing.school,
    castingTime: editing.castingTime ?? "",
    range: editing.range ?? "",
    components: editing.components ?? "",
    duration: editing.duration ?? "",
    desc: editing.desc ?? "",
    ritual: leveled?.ritual ?? false,
    concentration: leveled?.concentration ?? false,
  };
}

export default function SpellForm({ editing, onClose }: Props) {
  const add = useCharacter((s) => s.addCustomSpell);
  const update = useCharacter((s) => s.updateCustomSpell);
  const [draft, setDraft] = useState<CustomSpellDraft>(() => initialDraft(editing));
  const [error, setError] = useState<string | null>(null);

  const isCantrip = draft.level === 0;
  const set = <K extends keyof CustomSpellDraft>(k: K, v: CustomSpellDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const submit = () => {
    const res = editing ? update(editing.name, draft) : add(draft);
    if (res.ok) onClose();
    else setError(res.error);
  };

  return (
    <div className="bg-surface-container-high border border-outline-variant/30 rounded-xl p-md space-y-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-title-sm text-primary">
          {editing ? "Edit spell" : "Add spell"}
        </h3>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
        <label className="block sm:col-span-3">
          <span className="label-caps text-outline block mb-1">Name</span>
          <input
            className="input-inset w-full"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="label-caps text-outline block mb-1">Level</span>
          <select
            className="input-inset w-full"
            value={draft.level}
            onChange={(e) => set("level", Number(e.target.value) as 0 | SpellLevel)}
          >
            <option value={0}>Cantrip</option>
            {SPELL_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="label-caps text-outline block mb-1">School</span>
          <select
            className="input-inset w-full"
            value={draft.school}
            onChange={(e) => set("school", e.target.value as SpellSchool)}
          >
            {SPELL_SCHOOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <TextField
          label="Cast Time"
          value={draft.castingTime ?? ""}
          onChange={(v) => set("castingTime", v)}
        />
        <TextField label="Range" value={draft.range ?? ""} onChange={(v) => set("range", v)} />
        <TextField
          label="Components"
          value={draft.components ?? ""}
          onChange={(v) => set("components", v)}
        />
        <TextField
          label="Duration"
          value={draft.duration ?? ""}
          onChange={(v) => set("duration", v)}
        />
      </div>

      {/* Cantrips carry neither field on the type, so offering them would lie. */}
      {!isCantrip && (
        <div className="flex flex-wrap gap-md">
          <Check label="Ritual" checked={draft.ritual ?? false} onChange={(v) => set("ritual", v)} />
          <Check
            label="Concentration"
            checked={draft.concentration ?? false}
            onChange={(v) => set("concentration", v)}
          />
        </div>
      )}

      <label className="block">
        <span className="label-caps text-outline block mb-1">Description</span>
        <textarea
          className="input-inset w-full min-h-24"
          value={draft.desc ?? ""}
          onChange={(e) => set("desc", e.target.value)}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-sm">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-brass" onClick={submit}>
          <Icon name="check" /> Save spell
        </button>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="label-caps text-outline block mb-1">{label}</span>
      <input
        className="input-inset w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
