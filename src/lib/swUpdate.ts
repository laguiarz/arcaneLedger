import { create } from "zustand";
import { registerSW } from "virtual:pwa-register";

/**
 * Service-worker update state. The browser only looks for a new SW on page
 * load, so an installed PWA that never fully closes can serve a stale precache
 * indefinitely. We register by hand to attach a periodic check (plus focus /
 * online), and surface `needRefresh` so the UI can offer an explicit reload
 * instead of yanking the page out from under a session.
 *
 * NOT persisted — live runtime status only.
 */

const CHECK_EVERY_MS = 60 * 60 * 1000; // hourly
const MIN_GAP_MS = 5 * 60 * 1000; // throttle focus/online bursts

interface SwUpdateState {
  needRefresh: boolean;
  /** Activate the waiting service worker and reload the page. */
  updateNow: () => void;
}

export const useSwUpdate = create<SwUpdateState>()((set) => {
  let updateSW: ((reload?: boolean) => Promise<void>) | undefined;

  if (typeof window !== "undefined") {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        set({ needRefresh: true });
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        let last = 0;
        const check = () => {
          const now = Date.now();
          if (now - last < MIN_GAP_MS) return;
          last = now;
          void registration.update();
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
      void updateSW?.(true);
    },
  };
});
