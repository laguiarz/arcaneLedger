import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import Dashboard from "./views/Dashboard";
import Encounter from "./views/Encounter";
import Combat from "./views/Combat";
import Spellbook from "./views/Spellbook";
import Skills from "./views/Skills";
import Settings from "./views/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/encounter" element={<Encounter />} />
        <Route path="/combat" element={<Combat />} />
        <Route path="/spellbook" element={<Spellbook />} />
        <Route path="/skills" element={<Skills />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
