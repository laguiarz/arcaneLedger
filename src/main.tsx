import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { useSync } from "./store/sync";
import { useCharacter } from "./store/character";
import "./index.css";
// Registers the service worker and starts the periodic update check.
import "./lib/swUpdate";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);

// Cloud sync (offline-first): CHECK on boot and whenever we regain focus or
// connectivity — never apply. Applying used to happen here, which meant opening
// the app could silently overwrite a local edit that had never been uploaded.
// Both directions are now explicit actions in the header. Throttled so rapid
// focus events don't spam the network; a no-op unless sync is enabled.
let lastCheck = 0;
function maybeCheck() {
  const now = Date.now();
  if (now - lastCheck < 5000) return;
  lastCheck = now;
  void useSync.getState().checkRemote();
}
maybeCheck();
window.addEventListener("focus", maybeCheck);
window.addEventListener("online", maybeCheck);

// Switching characters points sync at a different key, so the previously seen
// remote stamp describes the wrong character until we re-check.
let lastCid = useCharacter.getState().activeCharacterId;
useCharacter.subscribe(() => {
  const cid = useCharacter.getState().activeCharacterId;
  if (cid === lastCid) return;
  lastCid = cid;
  useSync.setState({ remoteUpdatedAt: null });
  lastCheck = 0;
  maybeCheck();
});
