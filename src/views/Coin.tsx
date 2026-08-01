import { useEffect, useState } from "react";
import { useCoin, coinBalance, purseFor, type MagicItem } from "@/store/coin";
import { useCharacter } from "@/store/character";
import { partyRoster } from "@/lib/partyRoster";
import SectionHeader from "@/components/ui/SectionHeader";
import Icon from "@/components/ui/Icon";

function gold(n: number) {
  return `${n.toLocaleString()} gp`;
}

export default function Coin() {
  const activeCharacterId = useCharacter((s) => s.activeCharacterId);
  const cid = activeCharacterId ?? "custom";

  // First time this character is viewed, inherit the pre-v2 global purse.
  useEffect(() => {
    useCoin.getState().adoptLegacyPurse(cid);
  }, [cid]);

  // One selector for the whole purse, then derive. Never select a nested list
  // with `?? []` — a fresh array per snapshot reintroduces the getSnapshot
  // render loop that EMPTY_PURSE exists to prevent.
  const purse = useCoin((s) => purseFor(s, cid));
  const { startingGold, entries, treasure, partyItems, personalItems } = purse;
  const setStartingGold = useCoin((s) => s.setStartingGold);
  const addEntry = useCoin((s) => s.addEntry);
  const removeEntry = useCoin((s) => s.removeEntry);
  const addTreasure = useCoin((s) => s.addTreasure);
  const removeTreasure = useCoin((s) => s.removeTreasure);
  const addPartyItem = useCoin((s) => s.addPartyItem);
  const addPersonalItem = useCoin((s) => s.addPersonalItem);
  const removePartyItem = useCoin((s) => s.removePartyItem);
  const removePersonalItem = useCoin((s) => s.removePersonalItem);
  const updatePartyItem = useCoin((s) => s.updatePartyItem);
  const updatePersonalItem = useCoin((s) => s.updatePersonalItem);

  const character = useCharacter((s) => s.character);
  const roster = partyRoster(character);

  const balance = coinBalance(purse);

  // Running balance per entry (oldest→newest), then displayed newest-first.
  const chronological = [...entries].reverse();
  const runningById = new Map<string, number>();
  let acc = startingGold;
  for (const e of chronological) {
    acc += e.amount;
    runningById.set(e.id, acc);
  }

  return (
    <div className="max-w-6xl mx-auto p-md md:p-lg space-y-lg">
      <header className="flex flex-wrap items-end justify-between gap-sm">
        <div>
          <p className="label-caps text-outline">Coin Purse</p>
          <h1 className="font-serif text-display-lg text-primary leading-none">{gold(balance)}</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Running balance · gold only
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-outline">
          <span className="label-caps">Starting gold</span>
          <input
            type="number"
            value={startingGold}
            onChange={(e) => setStartingGold(cid, Number(e.target.value) || 0)}
            className="input-inset w-28 text-right font-mono text-on-surface"
            aria-label="Starting gold"
          />
        </label>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-md items-start">
        {/* Movements */}
        <section className="md:col-span-2 space-y-sm">
          <SectionHeader icon="account_balance" title="Movements" subtitle="Income and expenses" />
          <EntryForm onAdd={(amount, note) => addEntry(cid, amount, note)} />

          {entries.length === 0 ? (
            <p className="text-outline text-sm italic px-1">No movements yet.</p>
          ) : (
            <ul className="space-y-1">
              {entries.map((e) => {
                const income = e.amount >= 0;
                return (
                  <li
                    key={e.id}
                    className="flex items-center gap-2 bg-surface-container border border-outline-variant/30 rounded-lg px-sm py-2"
                  >
                    <Icon
                      name={income ? "trending_up" : "trending_down"}
                      filled
                      size={18}
                      className={income ? "text-secondary" : "text-error"}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-on-surface truncate">
                        {e.note || <span className="text-outline italic">No note</span>}
                      </div>
                      <div className="text-[11px] text-outline">
                        Balance {gold(runningById.get(e.id) ?? 0)}
                      </div>
                    </div>
                    <span
                      className={`font-mono text-sm shrink-0 ${income ? "text-secondary" : "text-error"}`}
                    >
                      {income ? "+" : "−"}
                      {gold(Math.abs(e.amount))}
                    </span>
                    <button
                      onClick={() => removeEntry(cid, e.id)}
                      className="btn-icon shrink-0"
                      aria-label="Delete movement"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Treasure */}
        <section className="space-y-sm">
          <SectionHeader icon="diamond" title="Treasure" subtitle="Found, not yet cashed" />
          <TreasureForm onAdd={(text) => addTreasure(cid, text)} />

          {treasure.length === 0 ? (
            <p className="text-outline text-sm italic px-1">Nothing hoarded yet.</p>
          ) : (
            <ul className="space-y-1">
              {treasure.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-2 bg-surface-container border border-outline-variant/30 rounded-lg px-sm py-2"
                >
                  <Icon name="diamond" size={16} className="text-primary shrink-0" />
                  <span className="text-sm text-on-surface flex-1 break-words">{t.text}</span>
                  <button
                    onClick={() => removeTreasure(cid, t.id)}
                    className="btn-icon shrink-0"
                    aria-label="Remove treasure"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-md items-start">
        {/* Party magic items */}
        <section className="space-y-sm">
          <SectionHeader
            icon="group"
            title="Party items"
            subtitle="Shared magic items and who carries them"
          />
          <ItemForm
            withCarrier
            roster={roster}
            onAdd={(name, note, carrier) =>
              addPartyItem(cid, { name, note, carrier })
            }
          />

          {partyItems.length === 0 ? (
            <p className="text-outline text-sm italic px-1">No party items yet.</p>
          ) : (
            <ul className="space-y-1">
              {partyItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  roster={roster}
                  onCarrier={(carrier) =>
                    updatePartyItem(cid, item.id, { carrier })
                  }
                  onNote={(note) => updatePartyItem(cid, item.id, { note })}
                  onRemove={() => removePartyItem(cid, item.id)}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Personal magic items */}
        <section className="space-y-sm">
          <SectionHeader
            icon="auto_awesome"
            title="Personal items"
            subtitle="Carried by this character"
          />
          <ItemForm onAdd={(name, note) => addPersonalItem(cid, { name, note })} />

          {personalItems.length === 0 ? (
            <p className="text-outline text-sm italic px-1">
              No personal items yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {personalItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onNote={(note) => updatePersonalItem(cid, item.id, { note })}
                  onRemove={() => removePersonalItem(cid, item.id)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function EntryForm({ onAdd }: { onAdd: (amount: number, note: string) => void }) {
  const [income, setIncome] = useState(true);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Math.abs(Math.round(Number(amount) || 0));
    if (!n) return;
    onAdd(income ? n : -n, note);
    setAmount("");
    setNote("");
  };

  return (
    <form onSubmit={submit} className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-sm space-y-2">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setIncome(true)}
          className={`flex-1 py-1.5 rounded-md text-sm font-bold transition ${
            income ? "bg-secondary/20 text-secondary border border-secondary/40" : "text-outline border border-transparent"
          }`}
        >
          <Icon name="add" size={16} /> Income
        </button>
        <button
          type="button"
          onClick={() => setIncome(false)}
          className={`flex-1 py-1.5 rounded-md text-sm font-bold transition ${
            !income ? "bg-error/20 text-error border border-error/40" : "text-outline border border-transparent"
          }`}
        >
          <Icon name="remove" size={16} /> Expense
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Gold"
          className="input-inset w-24 text-right font-mono text-on-surface"
          aria-label="Amount in gold"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (e.g. sold gems)"
          className="input-inset flex-1 text-on-surface"
          aria-label="Note"
        />
        <button type="submit" className="btn-brass shrink-0" aria-label="Add movement">
          <Icon name="check" filled />
        </button>
      </div>
    </form>
  );
}

function ItemForm({
  withCarrier = false,
  roster = [],
  onAdd,
}: {
  withCarrier?: boolean;
  roster?: string[];
  onAdd: (name: string, note: string, carrier: string) => void;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name, note, carrier);
    setName("");
    setNote("");
    setCarrier("");
  };

  return (
    <form
      onSubmit={submit}
      className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-sm space-y-2"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Item name…"
        className="input-inset w-full text-on-surface"
        aria-label="Item name"
      />
      <div className="flex gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (charges, attunement…)"
          className="input-inset flex-1 text-on-surface text-sm min-w-0"
          aria-label="Item note"
        />
        {withCarrier && (
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="input-inset text-on-surface text-sm shrink-0"
            aria-label="Carried by"
          >
            <option value="">Unassigned</option>
            {roster.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className="btn-brass shrink-0" aria-label="Add item">
          <Icon name="add" filled />
        </button>
      </div>
    </form>
  );
}

function ItemRow({
  item,
  roster,
  onCarrier,
  onNote,
  onRemove,
}: {
  item: MagicItem;
  roster?: string[];
  onCarrier?: (carrier: string) => void;
  onNote: (note: string) => void;
  onRemove: () => void;
}) {
  // A carrier can fall out of the roster: a party member removed in combat, a
  // sync pull replacing `party` wholesale, or the character re-imported under a
  // different name. A <select> whose value matches no option renders blank, so
  // the row would read as unassigned while still storing the old name.
  const options = roster ?? [];
  const dangling = item.carrier !== "" && !options.includes(item.carrier);

  return (
    <li className="bg-surface-container border border-outline-variant/30 rounded-lg px-sm py-2">
      <div className="flex items-center gap-2">
        <Icon name="auto_awesome" size={16} className="text-primary shrink-0" />
        <span className="text-sm text-on-surface flex-1 break-words">
          {item.name}
        </span>
        {onCarrier && (
          <select
            value={item.carrier}
            onChange={(e) => onCarrier(e.target.value)}
            className="input-inset text-xs text-on-surface shrink-0"
            aria-label={`Carried by, ${item.name}`}
          >
            <option value="">Unassigned</option>
            {options.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            {dangling && (
              <option value={item.carrier}>{item.carrier} (not in party)</option>
            )}
          </select>
        )}
        <button
          onClick={onRemove}
          className="btn-icon shrink-0"
          aria-label={`Remove ${item.name}`}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <input
        type="text"
        value={item.note}
        onChange={(e) => onNote(e.target.value)}
        placeholder="Note…"
        className="mt-1 w-full bg-transparent border-none px-0 text-[11px] text-outline focus:text-on-surface focus:outline-none"
        aria-label={`Note for ${item.name}`}
      />
    </li>
  );
}

function TreasureForm({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text);
    setText("");
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ruby the size of a fist…"
        className="input-inset flex-1 text-on-surface"
        aria-label="Treasure item"
      />
      <button type="submit" className="btn-brass shrink-0" aria-label="Add treasure">
        <Icon name="add" filled />
      </button>
    </form>
  );
}
