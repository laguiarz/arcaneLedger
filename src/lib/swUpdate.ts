import { create } from "zustand";
import { registerSW } from "virtual:pwa-register";
import { updateAction } from "./swUpdateAction";

/**
 * Service-worker update state.
 *
 * The browser only looks for a new service worker on page load, so an installed
 * PWA that never fully closes can serve a stale precache indefinitely. We
 * register by hand to attach a periodic check, and surface `needRefresh` so the
 * UI can offer an explicit reload instead of yanking the page out from under a
 * session.
 *
 * `updateNow` deliberately does NOT rely on there being a worker in "waiting".
 * That state is reachable and was observed while testing this: the prompt was
 * showing while `registration.waiting` was null, so `updateServiceWorker(true)`
 * messaged nobody and the click did nothing at all. A button that silently does
 * nothing is worse than no button, so this one always ends in a reload.
 *
 * NOT persisted — live runtime status only.
 */

const CHECK_EVERY_MS = 60 * 60 * 1000; // hourly
const MIN_GAP_MS = 5 * 60 * 1000; // throttle focus/online bursts
/** If skipWaiting + controllerchange hasn't reloaded us by then, reload anyway. */
const RELOAD_FALLBACK_MS = 1500;

interface SwUpdateState {
  needRefresh: boolean;
  /** Activate any waiting worker and reload. Always ends in a reload. */
  updateNow: () => void;
  /** Ask the browser to look for a new build right now. */
  checkNow: () => void;
}

export const useSwUpdate = create<SwUpdateState>()((set) => {
  let updateSW: ((reload?: boolean) => Promise<void>) | undefined;
  let registration: ServiceWorkerRegistration | undefined;

  if (typeof window !== "undefined") {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        set({ needRefresh: true });
      },
      onRegisteredSW(_swUrl, reg) {
        if (!reg) return;
        registration = reg;
        let last = 0;
        const check = () => {
          const now = Date.now();
          if (now - last < MIN_GAP_MS) return;
          last = now;
          void reg.update();
        };
        setInterval(check, CHECK_EVERY_MS);
        window.addEventListener("focus", check);
        window.addEventListener("online", check);
      },
    });
  }

  return {
    needRefresh: false,

    updateNow: () => {
      const action = updateAction({
        hasWaiting: !!registration?.waiting,
        canSkipWaiting: !!updateSW,
      });

      if (action === "reload-now") {
        window.location.reload();
        return;
      }

      // A worker is waiting: ask it to take over, which reloads the page on
      // controllerchange. The timer is a backstop, not the plan — without it a
      // click in a state we didn't anticipate would silently do nothing.
      try {
        void updateSW?.(true);
      } catch {
        /* the backstop below still runs */
      }
      setTimeout(() => window.location.reload(), RELOAD_FALLBACK_MS);
    },

    checkNow: () => {
      void registration?.update();
    },
  };
});
