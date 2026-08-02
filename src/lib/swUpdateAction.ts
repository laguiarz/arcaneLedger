/**
 * What pressing "Actualizar" should do.
 *
 * Lives in its own module with no imports so it can be unit-tested: `swUpdate.ts`
 * imports `virtual:pwa-register`, which does not resolve under Vitest.
 *
 * The prompt can be showing with NO worker in waiting — observed directly while
 * testing this: `needRefresh` true, `registration.waiting` null. In that state
 * there is nobody to send SKIP_WAITING to, so the old code messaged nobody and
 * the button did nothing at all. Reload instead: worst case it is a harmless
 * refresh, best case it picks up a worker that already activated.
 */
export type UpdateAction = "skip-waiting" | "reload-now";

export function updateAction(s: {
  hasWaiting: boolean;
  canSkipWaiting: boolean;
}): UpdateAction {
  return s.hasWaiting && s.canSkipWaiting ? "skip-waiting" : "reload-now";
}
