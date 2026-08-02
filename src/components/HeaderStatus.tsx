import Icon from "./ui/Icon";
import { useSync } from "@/store/sync";
import { useCharacter } from "@/store/character";
import { useSwUpdate } from "@/lib/swUpdate";
import { APP_COMMIT, APP_BUILD_TIME, formatVersion } from "@/lib/appVersion";
import { syncHeaderState } from "@/lib/syncFlags";

/**
 * The build you are running and the truth about your data, on every page.
 *
 * Both halves exist because their absence caused real incidents: a tablet ran a
 * stale build unnoticed for days, and an edit sat unsynced on a device while the
 * UI showed a green tick. Neither was discoverable without opening Settings.
 */
export default function HeaderStatus() {
  const needRefresh = useSwUpdate((s) => s.needRefresh);
  const updateNow = useSwUpdate((s) => s.updateNow);

  const status = useSync((s) => s.status);
  const lastError = useSync((s) => s.lastError);
  const dirty = useSync((s) => s.dirty);
  const remoteAhead = useSync((s) => s.remoteAhead);
  const enabled = useSync((s) => s.enabled);
  const pushNow = useSync((s) => s.pushNow);
  const pullNow = useSync((s) => s.pullNow);
  const activeCharacterId = useCharacter((s) => s.activeCharacterId);

  const sync = syncHeaderState({
    status,
    dirty,
    remoteAhead,
    enabled,
    hasCharacter: activeCharacterId !== null,
    message: lastError,
  });

  return (
    <div className="flex items-center gap-2 min-w-0">
      {/* The version is ALWAYS shown. It used to be replaced by the update
          button, which hid the one fact you need to tell whether updating
          worked: the hash has to change after you press it. */}
      <span
        className="font-mono text-[10px] text-outline truncate"
        title={`Build ${APP_COMMIT}`}
      >
        {formatVersion(APP_COMMIT, APP_BUILD_TIME)}
      </span>

      {needRefresh && (
        <button
          onClick={updateNow}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/50 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition"
          aria-label="Actualizar a la versión nueva"
        >
          <Icon name="system_update" size={14} filled />
          <span className="hidden md:inline">Actualizar</span>
        </button>
      )}

      {sync.kind !== "hidden" && (
        <div role="status" className="flex items-center gap-1 shrink-0">
          {sync.kind === "off" && (
            <span
              title="Sincronización desactivada — activala en Ajustes → Cloud sync"
              aria-label="Sincronización desactivada"
              className="inline-flex"
            >
              <Icon name="cloud_off" size={14} className="text-outline/60" />
            </span>
          )}

          {sync.kind === "busy" && (
            <Icon name="sync" size={14} className="text-primary animate-spin" />
          )}

          {sync.kind === "synced" && (
            <Icon
              name="cloud_done"
              size={14}
              filled
              className="text-secondary"
              aria-label="Sincronizado"
            />
          )}

          {sync.kind === "error" && (
            <span
              title={sync.message}
              aria-label={`Error de sincronización: ${sync.message}`}
              className="inline-flex"
            >
              <Icon name="cloud_off" size={14} filled className="text-error" />
            </span>
          )}

          {sync.kind === "conflict" && (
            <span
              title="Local y nube difieren — elegí qué hacer"
              aria-label="Los datos locales y los de la nube difieren"
              className="inline-flex"
            >
              <Icon name="sync_problem" size={14} filled className="text-primary" />
            </span>
          )}

          {(sync.kind === "save" || sync.kind === "conflict") && (
            <SyncButton
              icon="cloud_upload"
              label="Guardar"
              title="Subir los cambios locales a la nube"
              onClick={() => void pushNow({ force: true })}
            />
          )}

          {(sync.kind === "fetch" || sync.kind === "conflict") && (
            <SyncButton
              icon="cloud_download"
              label="Traer"
              title="Traer los datos de la nube y reemplazar los locales"
              onClick={() => void pullNow()}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SyncButton({
  icon,
  label,
  title,
  onClick,
}: {
  icon: string;
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="inline-flex items-center gap-1 rounded-md border border-outline-variant/50 px-1.5 py-0.5 text-[11px] font-bold text-on-surface-variant hover:text-primary hover:border-primary/50 transition"
    >
      <Icon name={icon} size={14} filled />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
