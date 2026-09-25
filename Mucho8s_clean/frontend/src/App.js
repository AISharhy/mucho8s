import "@/App.css";
import { HashRouter, Routes, Route } from "react-router-dom";
import { DataProvider } from "@/context/DataContext";
import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/sonner";
import Dashboard from "@/pages/Dashboard";
import Players from "@/pages/Players";
import TeamBalancer from "@/pages/TeamBalancer";
import Matches from "@/pages/Matches";
import Leaderboard from "@/pages/Leaderboard";
import Statistics from "@/pages/Statistics";
import AdminPanel from "@/pages/AdminPanel";

function App() {
  return (
    <div className="App">
      <DataProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="players" element={<Players />} />
              <Route path="balancer" element={<TeamBalancer />} />
              <Route path="matches" element={<Matches />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="statistics" element={<Statistics />} />
              <Route path="admin" element={<AdminPanel />} />
            </Route>
          </Routes>
          <Toaster position="top-right" theme="dark" richColors />
        </HashRouter>
      </DataProvider>
    </div>
  );
}

export default App;
