import "@/App.css";
import { HashRouter, Routes, Route } from "react-router-dom";
import { DataProvider } from "@/context/DataContext";
import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/sonner";
import Dashboard from "@/pages/Dashboard";
import Players from "@/pages/Players";
import PlayerProfile from "@/pages/PlayerProfile";
import TeamBalancer from "@/pages/TeamBalancer";
import Matches from "@/pages/Matches";
import Ranking from "@/pages/Ranking";
import AdminPanel from "@/pages/AdminPanel";
import ChallengeMatch from "@/pages/ChallengeMatch";
import ChallengeInbox from "@/pages/ChallengeInbox";
import ChallengeLeaderboard from "@/pages/ChallengeLeaderboard";

function App() {
  return (
    <div className="App">
      <DataProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="players" element={<Players />} />
              <Route path="players/:id" element={<PlayerProfile />} />
              <Route path="balancer" element={<TeamBalancer />} />
              <Route path="matches" element={<Matches />} />
              <Route path="ranking" element={<Ranking />} />
              <Route path="leaderboard" element={<Ranking initialTab="leaderboard" />} />
              <Route path="statistics" element={<Ranking initialTab="statistics" />} />
              <Route path="admin" element={<AdminPanel />} />
              <Route path="challenges" element={<ChallengeInbox />} />
              <Route path="challenge-ranking" element={<ChallengeLeaderboard />} />
              <Route path="challenges/:id" element={<ChallengeMatch />} />
            </Route>
          </Routes>
          <Toaster position="top-right" theme="dark" richColors />
        </HashRouter>
      </DataProvider>
    </div>
  );
}

export default App;
