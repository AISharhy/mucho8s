import React from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { Swords } from "lucide-react";

const TITLES = {
  "/": "Dashboard",
  "/players": "Players",
  "/balancer": "Team Balancer",
  "/matches": "Matches",
  "/leaderboard": "Leaderboard",
  "/statistics": "Statistics",
  "/admin": "Admin Panel",
};

export const Layout = () => {
  const loc = useLocation();
  const title = TITLES[loc.pathname] || (loc.pathname.startsWith("/players/") ? "Player Profile" : "MuchoMoney8s");
  return (
    <div className="min-h-screen bg-[#090A0F]">
      <Sidebar />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 h-16 flex items-center justify-between px-4 sm:px-6 bg-[#10121A]/85 backdrop-blur-md border-b border-[#242938]">
          <div className="flex items-center gap-4">
            <MobileNav />
            <h1 className="hidden lg:block font-display text-xl font-bold tracking-tight">{title}</h1>
          </div>
          <Link
            to="/balancer"
            data-testid="header-quick-balance-btn"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-magma hover:bg-magma/90 text-white text-sm font-semibold transition-all magma-glow"
          >
            <Swords size={16} /> <span className="hidden sm:inline">Quick Balance</span>
          </Link>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
