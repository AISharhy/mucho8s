import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import ChallengeCenter from "@/components/ChallengeCenter";

const TITLES = {
  "/": "Dashboard",
  "/players": "Players",
  "/balancer": "Team Balancer",
  "/matches": "Matches",
  "/ranking": "Ranking",
  "/leaderboard": "Ranking",
  "/statistics": "Ranking",
  "/admin": "Admin Panel",
};

export const Layout = () => {
  const loc = useLocation();
  const title = TITLES[loc.pathname] || (loc.pathname.startsWith("/players/") ? "Player Profile" : loc.pathname.startsWith("/challenges/") ? "Challenge Match" : "MuchoMoney8s");

  return (
    <div className="min-h-screen bg-[#090A0F]">
      <ChallengeCenter />
      <Sidebar />
      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 h-16 flex items-center px-4 sm:px-6 bg-[#0D1016]/88 backdrop-blur-xl border-b border-[#1D222C]">
          <MobileNav />
          <div className="hidden lg:flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-magma" /><h1 className="font-display text-[18px] font-bold tracking-tight">{title}</h1></div>
        </header>
        <main className="page-shell p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
