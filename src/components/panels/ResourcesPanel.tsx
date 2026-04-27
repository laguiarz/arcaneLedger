import { useState } from "react";
import { useCharacter } from "@/store/character";
import type { RechargeType, Resource } from "@/types/character";
import Icon from "../ui/Icon";

const RECHARGE_LABEL: Record<RechargeType, string> = {
  long: "Long Rest",
  short: "Short Rest",
  dawn: "Dawn",
  manual: "Manual",
};

const RECHARGE_TONE: Record<RechargeType, string> = {
  long: "text-primary border-primary/30 bg-primary/10",
  short: "text-secondary border-secondary/30 bg-secondary/10",
  dawn: "text-tertiary border-tertiary/30 bg-tertiary/10",
  manual: "text-outline border-outline-variant/40 bg-surface-container-low",
};

export default function ResourcesPanel() {
  const resources = useCharacter((s) => s.character.resources);

  if (resources.length === 0) {
    return (
      <div className="text-sm text-outline italic">No tracked abilities or items.</div>
    );
  }

  return (
    <div className="space-y-2">
      {resources.map((r, i) => (
        <ResourceCard key={r.id ?? r.name + i} resource={r} />
      ))}
    </div>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  const useResource = useCharacter((s) => s.useResource);
  const refund = useCharacter((s) => s.refundResource);
  const setUsed = useCharacter((s) => s.setResource);
  const [open, setOpen] = useState(false);

  const remaining = resource.max - resource.used;
  const isCounter = resource.max > 0;

  return (
    <div className="bg-surface-container border border-amber-900/30 rounded-xl p-sm relative overflow-hidden">
      <div className="leather-noise absolute inset-0" />
      <div className="relative">
        <div className="flex items-start justify-between gap-sm">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-serif text-on-surface text-base leading-tight truncate">{resource.name}</h4>
              {resource.source && (
                <span className="chip bg-surface-container-highest text-on-surface-variant border border-outline-variant/40">
                  {resource.source}
                </span>
              )}
              <span className={`chip border ${RECHARGE_TONE[resource.recharge]}`}>
                <Icon name="schedule" size={11} className="mr-1" />
                {RECHARGE_LABEL[resource.recharge]}
              </span>
            </div>
            {resource.desc && (
              <button
                onClick={() => setOpen((o) => !o)}
                className="text-xs text-outline hover:text-on-surface-variant flex items-center gap-1 mt-1"
              >
                <Icon name={open ? "expand_less" : "expand_more"} size={14} />
                {open ? "Hide" : "Show"} details
              </button>
            )}
          </div>

          {isCounter ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                className="btn-icon"
                disabled={resource.used <= 0}
                onClick={() => refund(resource.name)}
                aria-label="Refund use"
              >
                <Icon name="undo" />
              </button>
              <div className="flex flex-col items-center min-w-[60px]">
                <span className="font-serif text-primary text-xl leading-none">{remaining}</span>
                <span className="text-[10px] text-outline">/{resource.max}</span>
              </div>
              <button
                className="btn-icon !bg-primary/15 !border-primary/40 !text-primary"
                disabled={remaining <= 0}
                onClick={() => useResource(resource.name)}
                aria-label="Use"
              >
                <Icon name="bolt" filled />
              </button>
            </div>
          ) : (
            <span className="text-xs text-outline italic shrink-0">passive</span>
          )}
        </div>

        {isCounter && resource.max <= 10 && (
          <div className="flex gap-1 mt-2">
            {Array.from({ length: resource.max }).map((_, i) => {
              const used = i >= remaining;
              return (
                <button
                  key={i}
                  onClick={() => setUsed(resource.name, used ? i : i + 1)}
                  className={`flex-1 h-2 rounded-sm transition ${
                    used
                      ? "bg-surface-container-highest border border-amber-900/50"
                      : "bg-primary/80 shadow-[0_0_6px_rgba(233,193,118,0.4)]"
                  }`}
                  aria-label={used ? `Restore use ${i + 1}` : `Spend use ${i + 1}`}
                />
              );
            })}
          </div>
        )}

        {open && resource.desc && (
          <p className="text-sm text-on-surface-variant italic mt-2 pt-2 border-t border-outline-variant/30">
            {resource.desc}
          </p>
        )}
      </div>
    </div>
  );
}
