import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar, MobileNav } from "@/components/Sidebar";

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
  const title = TITLES[loc.pathname] || (loc.pathname.startsWith("/players/") ? "Player Profile" : "MuchoMoney8s");

  return (
    <div className="min-h-screen bg-[#090A0F]">
      <Sidebar />
      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 h-16 flex items-center px-4 sm:px-6 bg-[#10121A]/85 backdrop-blur-md border-b border-[#242938]">
          <MobileNav />
          <h1 className="hidden lg:block font-display text-xl font-bold tracking-tight">{title}</h1>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
