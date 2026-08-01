import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { useSync } from "@/store/sync";
import {
  getSecret,
  setSecret,
  isSyncEnabled,
  setSyncEnabled,
  getLastSynced,
} from "@/lib/syncConfig";

/**
 * Cloud-sync controls: shared secret, on/off, and a manual "Sync now". Offline
 * -first, so this is all optional — the app works fully without it.
 */
export default function CloudSyncSettings() {
  const status = useSync((s) => s.status);
  const lastError = useSync((s) => s.lastError);

  const [secretDraft, setSecretDraft] = useState(getSecret());
  const [enabled, setEnabled] = useState(isSyncEnabled());
  const [saved, setSaved] = useState(false);
  const [lastSynced, setLastSyncedState] = useState<number | null>(getLastSynced());

  const persist = () => {
    setSecret(secretDraft);
    // Enabling requires a secret; the config helper already enforces this on read.
    setSyncEnabled(enabled && secretDraft.trim().length > 0);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const syncNow = async () => {
    persist();
    await useSync.getState().syncNow();
    setLastSyncedState(getLastSynced());
  };

  return (
    <section className="bg-surface-container border border-outline-variant/30 rounded-xl p-md relative overflow-hidden">
      <div className="leather-noise absolute inset-0" />
      <div className="relative space-y-sm">
        <h3 className="font-serif text-title-sm text-primary">Cloud sync</h3>
        <p className="text-sm text-on-surface-variant">
          Sincroniza habilidades, oro y la crónica de combates entre tus
          dispositivos. Funciona offline: se guarda local y sincroniza cuando hay
          conexión.
        </p>

        <label className="flex flex-col gap-1">
          <span className="label-caps text-outline text-[10px]">
            Secreto compartido
          </span>
          <input
            type="password"
            value={secretDraft}
            onChange={(e) => setSecretDraft(e.target.value)}
            placeholder="El mismo secreto en todos tus dispositivos"
            className="input-inset w-full font-mono text-xs"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Activar sincronización
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button className="btn-ghost !py-1" onClick={persist}>
            <Icon name="save" /> Guardar
          </button>
          <button
            className="btn-brass !py-1"
            onClick={() => void syncNow()}
            disabled={status === "syncing" || !secretDraft.trim()}
          >
            <Icon name="cloud_sync" filled /> Sincronizar ahora
          </button>
          {saved && <span className="text-[11px] text-secondary">Guardado</span>}
          <StatusPill status={status} />
        </div>

        {lastSynced && (
          <p className="text-[11px] text-outline">
            Última sync: {new Date(lastSynced).toLocaleString()}
          </p>
        )}
        {status === "error" && lastError && (
          <p className="text-[11px] text-error border border-error/40 bg-error/10 rounded-md px-sm py-1">
            {lastError}
          </p>
        )}

        <p className="text-[10px] text-outline italic">
          El secreto se guarda solo en este dispositivo. Para un único usuario con
          datos no sensibles, alcanza.
        </p>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { icon: string; label: string; cls: string }> = {
    idle: { icon: "cloud", label: "En espera", cls: "text-outline" },
    syncing: { icon: "sync", label: "Sincronizando…", cls: "text-primary" },
    ok: { icon: "cloud_done", label: "Sincronizado", cls: "text-secondary" },
    error: { icon: "cloud_off", label: "Error", cls: "text-error" },
    offline: { icon: "cloud_off", label: "Offline", cls: "text-outline" },
  };
  const s = map[status] ?? map.idle;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${s.cls}`}>
      <Icon name={s.icon} size={14} filled />
      {s.label}
    </span>
  );
}
