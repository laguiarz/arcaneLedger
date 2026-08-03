import Icon from "./ui/Icon";
import { useSync } from "@/store/sync";
import { useLibrary } from "@/store/library";
import { useCharacter } from "@/store/character";
import { useSwUpdate } from "@/lib/swUpdate";
import { APP_COMMIT, APP_BUILD_TIME, formatVersion } from "@/lib/appVersion";
import { syncHeaderState } from "@/lib/syncFlags";
import { libraryNotice } from "@/lib/libraryFlags";

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
  const libraryRevision = useCharacter((s) => s.libraryRevision);

  const availableRevision = useLibrary((s) => s.availableRevision);
  const reloading = useLibrary((s) => s.reloading);
  const reloadFromLibrary = useLibrary((s) => s.reload);

  const notice = libraryNotice({
    activeCharacterId,
    loadedRevision: libraryRevision,
    availableRevision,
    appUpdatePending: needRefresh,
  });

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

      {/* A different axis of staleness from the ☁: this one is about the sheet
          PUBLISHED in the library, not about your own synced edits. Styled like
          "Actualizar" rather than like the sync buttons so it doesn't read as a
          third sync action, and rendered at all only while there is something to
          say — which is what keeps a destructive one-tap reload out of reach the
          rest of the time. */}
      {notice !== "none" && (
        <button
          onClick={() => void reloadFromLibrary()}
          disabled={reloading}
          title={LIBRARY_LABEL[notice]}
          aria-label={LIBRARY_LABEL[notice]}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/50 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition disabled:opacity-60"
        >
          <Icon
            name={reloading ? "progress_activity" : "menu_book"}
            size={14}
            filled
            className={reloading ? "animate-spin" : undefined}
          />
          <span className="hidden md:inline">Ficha</span>
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

/**
 * Two labels, because they are two different claims. In the "unknown" case the
 * app has no idea whether a newer version exists — it only knows it can't tell —
 * and saying otherwise would be a lie told to every install on the first boot
 * after this shipped.
 */
const LIBRARY_LABEL = {
  update:
    "Hay una versión nueva de la ficha en la librería — recargar (se pierde el estado de la sesión)",
  unknown:
    "No sé de qué versión viene esta ficha — recargar desde la librería (se pierde el estado de la sesión)",
} as const;

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
