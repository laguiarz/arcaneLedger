import Icon from "@/components/ui/Icon";
import { useSwUpdate } from "@/lib/swUpdate";

/**
 * Shown only when a newer build is waiting. Sits above the mobile bottom nav
 * (h-16) so it never covers navigation.
 */
export default function UpdateBar() {
  const needRefresh = useSwUpdate((s) => s.needRefresh);
  const updateNow = useSwUpdate((s) => s.updateNow);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed left-0 right-0 bottom-16 md:bottom-4 z-50 flex justify-center px-md"
    >
      <div className="flex items-center gap-3 bg-surface-container border border-primary/40 rounded-xl px-md py-2 shadow-2xl">
        <Icon name="system_update" className="text-primary" filled />
        <span className="text-sm text-on-surface">Hay una versión nueva</span>
        <button className="btn-brass !py-1" onClick={updateNow}>
          Actualizar
        </button>
      </div>
    </div>
  );
}
