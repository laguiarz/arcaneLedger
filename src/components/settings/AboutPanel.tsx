import Icon from "@/components/ui/Icon";
import { APP_COMMIT, APP_BUILD_TIME, formatVersion } from "@/lib/appVersion";
import { useSwUpdate } from "@/lib/swUpdate";

/**
 * Which build is this? Without it, "the feature is missing" and "this device
 * is on a stale cached build" are indistinguishable.
 */
export default function AboutPanel() {
  const needRefresh = useSwUpdate((s) => s.needRefresh);
  const updateNow = useSwUpdate((s) => s.updateNow);

  return (
    <section className="bg-surface-container border border-outline-variant/30 rounded-xl p-md relative overflow-hidden">
      <div className="leather-noise absolute inset-0" />
      <div className="relative space-y-sm">
        <h3 className="font-serif text-title-sm text-primary">Acerca de</h3>
        <p className="text-sm text-on-surface-variant">Arcanist&rsquo;s Ledger</p>
        <p className="font-mono text-xs text-on-surface">
          {formatVersion(APP_COMMIT, APP_BUILD_TIME)}
        </p>

        {needRefresh ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-primary">
              <Icon name="system_update" size={14} filled />
              Actualización disponible
            </span>
            <button className="btn-brass !py-1" onClick={updateNow}>
              <Icon name="refresh" /> Actualizar
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-secondary">
            <Icon name="check_circle" size={14} filled />
            Actualizada
          </span>
        )}

        <p className="text-[10px] text-outline italic">
          Si acabás de publicar algo y seguís viendo esta versión, la app está
          usando una copia en caché: recargá o cerrá y abrí la PWA del todo.
        </p>
      </div>
    </section>
  );
}
