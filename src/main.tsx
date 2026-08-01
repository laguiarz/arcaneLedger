import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { useSync } from "./store/sync";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);

// Cloud sync (offline-first): pull on boot and whenever we regain focus or
// connectivity. Throttled so rapid focus events don't spam the network; a no-op
// unless the user has enabled sync in Settings.
let lastPull = 0;
function maybePull() {
  const now = Date.now();
  if (now - lastPull < 5000) return;
  lastPull = now;
  void useSync.getState().pull();
}
maybePull();
window.addEventListener("focus", maybePull);
window.addEventListener("online", maybePull);
