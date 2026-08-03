import { useState } from "react";
import { useCharacter } from "@/store/character";
import { parseRechargeDice } from "@/lib/rechargeDice";
import type { Resource } from "@/types/character";
import Icon from "./ui/Icon";

/**
 * "Regains 1d6 charges daily at dawn" — you roll the physical die, the app
 * takes the number.
 *
 * This lives on the item rather than inside the Rest menu because dawn is a
 * clock event, not a rest: you can long rest twice in a day, or rest without
 * crossing a dawn.
 */
export default function DawnRecharge({ resource }: { resource: Resource }) {
  const refund = useCharacter((s) => s.refundResource);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  if (!resource.rechargeDice) return null;

  const range = parseRechargeDice(resource.rechargeDice);
  const n = Number(value);
  const valid =
    value.trim() !== "" &&
    Number.isInteger(n) &&
    n >= 1 &&
    // An unparseable dice string gets no upper bound rather than a wrong one.
    (range === null || (n >= range.min && n <= range.max));
  // What you will actually get back, which is not the roll when you are nearly full.
  const gain = valid ? Math.min(n, resource.used) : 0;
  const atFull = resource.used <= 0;

  function commit() {
    if (!valid) return;
    refund(resource.name, n);
    setValue("");
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={atFull}
        className="shrink-0 btn-icon !w-7 !h-7 disabled:opacity-30"
        aria-label={`Dawn recharge — roll ${resource.rechargeDice}`}
        title={
          atFull
            ? "Already at full charges"
            : `Dawn — roll ${resource.rechargeDice}`
        }
      >
        <Icon name="wb_sunny" size={14} />
      </button>

      {open && !atFull && (
        <div className="w-full mt-1 flex flex-wrap items-center gap-2 border-t border-outline-variant/30 pt-2 animate-fade-in">
          <span className="text-[11px] text-on-surface-variant">
            Roll {resource.rechargeDice} and enter the result.
          </span>
          <input
            type="number"
            inputMode="numeric"
            placeholder={resource.rechargeDice}
            min={range?.min ?? 1}
            max={range?.max}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
            }}
            className="input-inset w-16 text-center font-mono"
            aria-label={`Result of ${resource.rechargeDice}`}
            autoFocus
          />
          <button
            onClick={commit}
            disabled={!valid}
            className="btn-brass text-sm disabled:opacity-40"
          >
            Recharge
            {gain > 0 && <span className="ml-1 text-on-primary/80">+{gain}</span>}
          </button>
        </div>
      )}
    </>
  );
}
