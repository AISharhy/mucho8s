import "@/App.css";
import React, { useEffect, useState } from "react";
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
import RankGuide from "@/pages/RankGuide";
import AdminPanel from "@/pages/AdminPanel";
import ChallengeMatch from "@/pages/ChallengeMatch";
import ChallengeInbox from "@/pages/ChallengeInbox";

function IntroSplash({ onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1350);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="m8-intro" aria-label="MuchoMoney8s">
      <div className="m8-intro-inner">
        <div className="m8-intro-logo-wrap">
          <img
            src={`${process.env.PUBLIC_URL}/logo-mark.svg`}
            alt="MuchoMoney8s"
            className="m8-intro-logo"
          />
          <span className="m8-intro-slash" />
        </div>
        <div className="m8-intro-wordmark">
          <span>MUCHO</span><strong>MONEY</strong><span>8s</span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return sessionStorage.getItem("mucho8s_intro_seen") !== "1";
    } catch {
      return true;
    }
  });

  const finishIntro = () => {
    try {
      sessionStorage.setItem("mucho8s_intro_seen", "1");
    } catch {}
    setShowIntro(false);
  };
  if (showIntro) return <IntroSplash onDone={finishIntro} />;

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
              <Route path="challenge-ranking" element={<Ranking initialTab="challenges" />} />
              <Route path="rank-guide" element={<RankGuide />} />
              <Route path="ranks" element={<RankGuide />} />
              <Route path="admin" element={<AdminPanel />} />
              <Route path="challenges" element={<ChallengeInbox />} />
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
