import { useEffect, useState } from "react";
import { useCoin, coinBalance, purseFor } from "@/store/coin";
import { useCharacter } from "@/store/character";
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

  const purse = useCoin((s) => purseFor(s, cid));
  const { startingGold, entries, treasure } = purse;
  const setStartingGold = useCoin((s) => s.setStartingGold);
  const addEntry = useCoin((s) => s.addEntry);
  const removeEntry = useCoin((s) => s.removeEntry);
  const addTreasure = useCoin((s) => s.addTreasure);
  const removeTreasure = useCoin((s) => s.removeTreasure);

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
