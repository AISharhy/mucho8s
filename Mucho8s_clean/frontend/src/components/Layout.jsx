import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import ChallengeCenter from "@/components/ChallengeCenter";
import { Bell } from "lucide-react";
import { useData } from "@/context/DataContext";

const TITLES = {
  "/": "Dashboard",
  "/players": "Players",
  "/balancer": "Team Balancer",
  "/matches": "Matches",
  "/ranking": "Ranking",
  "/leaderboard": "Ranking",
  "/statistics": "Ranking",
  "/admin": "Admin Panel",
  "/challenges": "Challenge Inbox",
  "/challenge-ranking": "Chall Ranking",
};

export const Layout = () => {
  const loc = useLocation();
  const { discordPlayer, challengeNotificationCount } = useData();
  const title = TITLES[loc.pathname] || (loc.pathname.startsWith("/players/") ? "Player Profile" : loc.pathname.startsWith("/challenges/") ? "Challenge Match" : "MuchoMoney8s");

  return (
    <div className="min-h-screen bg-[#07090E]">
      <ChallengeCenter />
      <Sidebar />
      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 h-16 flex items-center px-4 sm:px-6 bg-[#0B0E15]/88 backdrop-blur-xl border-b border-[#252C39]">
          <MobileNav />
          <div className="hidden lg:flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-magma" />
            <h1 className="font-display text-[18px] font-bold tracking-tight">{title}</h1>
          </div>

          <div className="ml-auto flex items-center">
            {discordPlayer && (
              <Link
                to="/challenges"
                aria-label={challengeNotificationCount > 0 ? `${challengeNotificationCount} challenge notifications` : "Challenge notifications"}
                title="Challenge notifications"
                data-testid="header-challenge-bell"
                className="relative w-10 h-10 rounded-xl border border-[#303947] bg-[#121720] hover:bg-white/[0.05] hover:border-[#465264] transition-all flex items-center justify-center text-[#AEB7C6] hover:text-white"
              >
                <Bell size={19} />
                {challengeNotificationCount > 0 && (
                  <span
                    data-testid="header-challenge-badge"
                    className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 rounded-full bg-magma border-2 border-[#0B0E15] text-white text-[9px] font-extrabold leading-none flex items-center justify-center shadow-[0_0_14px_rgba(255,42,59,0.45)]"
                  >
                    {challengeNotificationCount > 99 ? "99+" : challengeNotificationCount}
                  </span>
                )}
              </Link>
            )}
          </div>
        </header>
        <main className="page-shell p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
