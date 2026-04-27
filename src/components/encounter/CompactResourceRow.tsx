import { useState } from "react";
import { useCharacter } from "@/store/character";
import type { RechargeType, Resource } from "@/types/character";
import Icon from "../ui/Icon";

const RECHARGE_LABEL: Record<RechargeType, string> = {
  long: "LR",
  short: "SR",
  dawn: "Dawn",
  manual: "—",
};

export default function CompactResourceRow({ resource }: { resource: Resource }) {
  const useResource = useCharacter((s) => s.useResource);
  const refund = useCharacter((s) => s.refundResource);
  const [open, setOpen] = useState(false);

  const remaining = resource.max - resource.used;
  const isCounter = resource.max > 0;

  return (
    <div className="bg-surface-container-low border border-outline-variant/40 rounded-md hover:border-primary/40 transition">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span
          className="shrink-0 w-6 h-6 inline-flex items-center justify-center rounded text-[9px] font-bold bg-surface-container-highest text-on-surface-variant border border-outline-variant/50"
          title={`Recharge: ${resource.recharge}`}
        >
          {RECHARGE_LABEL[resource.recharge]}
        </span>
        <button
          className="flex-1 min-w-0 text-left"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="font-serif text-sm text-on-surface truncate block">{resource.name}</span>
        </button>

        {isCounter ? (
          <>
            <span className="font-mono text-xs text-on-surface-variant shrink-0">
              <span className="text-primary font-bold">{remaining}</span>/{resource.max}
            </span>
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
        </div>
      )}
    </div>
  );
}
