import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import Dashboard from "./views/Dashboard";
import Encounter from "./views/Encounter";
import Spellbook from "./views/Spellbook";
import Settings from "./views/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/encounter" element={<Encounter />} />
        <Route path="/spellbook" element={<Spellbook />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
