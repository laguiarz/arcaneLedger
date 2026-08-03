import { useState } from "react";
import { useCharacter, findSpell, spellSaveDc } from "@/store/character";
import type { RechargeType, Resource } from "@/types/character";
import Icon from "../ui/Icon";
import { useInspire } from "../InspireModal";
import DawnRecharge from "../DawnRecharge";

const RECHARGE_LABEL: Record<RechargeType, string> = {
  long: "LR",
  short: "SR",
  dawn: "Dawn",
  manual: "—",
};

export default function CompactResourceRow({ resource }: { resource: Resource }) {
  const useResource = useCharacter((s) => s.useResource);
  const refund = useCharacter((s) => s.refundResource);
  const c = useCharacter((s) => s.character);
  const setConcentration = useCharacter((s) => s.setConcentration);
  // An item you can cast from should not hide its own button behind a chevron.
  const [open, setOpen] = useState(Boolean(resource.itemSpell));
  const inspire = useInspire(resource.inspirePhraseDeck);

  const remaining = resource.max - resource.used;
  const isCounter = resource.max > 0;

  // findSpell searches the spellbook AND innateSpells — the same lookup
  // ConcentrationBar uses, so the row and the bar can never disagree. An
  // unresolvable reference degrades the row to a plain counter.
  const itemSpell = resource.itemSpell
    ? findSpell(c, resource.itemSpell.name)
    : undefined;

  // setConcentration overwrites without asking, so name what will be lost.
  const replaces =
    itemSpell?.concentration &&
    c.concentration &&
    c.concentration.spellName !== itemSpell.name
      ? c.concentration.spellName
      : null;

  function castFromItem() {
    if (!itemSpell || remaining <= 0) return;
    // The charge is the whole cost — casting from an item never spends a slot.
    useResource(resource.name);
    if (itemSpell.concentration) {
      setConcentration(itemSpell.name, itemSpell.level);
    }
  }

  return (
    <div className="bg-surface-container-low border border-outline-variant/40 rounded-md hover:border-primary/40 transition">
      {/* flex-wrap so the dawn control's input can drop to its own line. */}
      <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
        <span
          className="shrink-0 w-6 h-6 inline-flex items-center justify-center rounded text-[9px] font-bold bg-surface-container-highest text-on-surface-variant border border-outline-variant/50"
          title={
            resource.rechargeDice
              ? `Recharge: ${resource.rechargeDice} at dawn`
              : `Recharge: ${resource.recharge}`
          }
        >
          {resource.rechargeDice ? "☀" : RECHARGE_LABEL[resource.recharge]}
        </span>
        <button
          className="flex-1 min-w-0 text-left"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="font-serif text-sm text-on-surface truncate block">{resource.name}</span>
        </button>

        {inspire.enabled && (
          <button
            onClick={inspire.draw}
            className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md border bg-tertiary/10 border-tertiary/40 text-tertiary hover:bg-tertiary/25 transition"
            aria-label="Inspirar — frase para tu compañero"
            title="Inspirar — frase para tu compañero"
          >
            <Icon name="auto_awesome" size={16} filled />
          </button>
        )}

        {isCounter ? (
          <>
            <span className="font-mono text-xs text-on-surface-variant shrink-0">
              <span className="text-primary font-bold">{remaining}</span>/{resource.max}
            </span>
            <DawnRecharge resource={resource} />
            <button
              onClick={() => refund(resource.name)}
              disabled={resource.used <= 0}
              className="shrink-0 btn-icon !w-7 !h-7 disabled:opacity-30"
              aria-label="Refund use"
            >
              <Icon name="undo" size={14} />
            </button>
            <button
              onClick={() => useResource(resource.name)}
              disabled={remaining <= 0}
              className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md border transition ${
                remaining > 0
                  ? "bg-primary/15 border-primary/50 text-primary hover:bg-primary/25"
                  : "bg-surface-container-low border-outline-variant/40 text-outline cursor-not-allowed"
              }`}
              aria-label="Use"
              title={remaining > 0 ? "Use" : "Depleted"}
            >
              <Icon name="bolt" filled size={16} />
            </button>
          </>
        ) : (
          <span className="text-[10px] text-outline italic shrink-0">passive</span>
        )}

        <button
          className="shrink-0 btn-icon !w-7 !h-7"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle details"
        >
          <Icon name={open ? "expand_less" : "expand_more"} size={16} />
        </button>
      </div>

      {open && (
        <div className="px-2 pb-2 pt-1 border-t border-outline-variant/30 animate-fade-in">
          {resource.source && (
            <div className="text-[10px] text-outline">
              <span className="label-caps">Source</span> {resource.source}
            </div>
          )}
          {resource.desc && (
            <p className="text-[11px] text-on-surface-variant italic mt-1 leading-snug">
              {resource.desc}
            </p>
          )}

          {itemSpell && (
            <div className="mt-2 border-t border-outline-variant/30 pt-2 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={castFromItem}
                  disabled={remaining <= 0}
                  className="btn-brass text-sm disabled:opacity-40"
                  aria-label={`Cast ${itemSpell.name} — spends 1 charge`}
                  title={
                    replaces
                      ? `Cast — drops concentration on ${replaces}`
                      : `Cast ${itemSpell.name} — spends 1 charge`
                  }
                >
                  <Icon name="auto_fix_high" filled size={16} /> Cast {itemSpell.name}
                </button>
                {replaces && (
                  <span className="text-[10px] text-error">Replaces {replaces}</span>
                )}
              </div>

              <p className="text-[10px] text-outline font-mono">
                {resource.itemSpell?.saveDc !== undefined && (
                  <span>DC {resource.itemSpell.saveDc} (item) · </span>
                )}
                <span>DC {spellSaveDc(c)} (yours)</span>
              </p>

              {itemSpell.desc && (
                <p className="text-[11px] text-on-surface-variant italic leading-snug whitespace-pre-line">
                  {itemSpell.desc}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {inspire.modal}
    </div>
  );
}
