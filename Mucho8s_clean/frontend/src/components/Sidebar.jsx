import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Swords, Gamepad2, Trophy, BarChart3, Shield, Menu, X, Flame,
} from "lucide-react";
import { useData } from "@/context/DataContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, testid: "nav-dashboard-link" },
  { to: "/players", label: "Players", icon: Users, testid: "nav-players-link" },
  { to: "/balancer", label: "Team Balancer", icon: Swords, testid: "nav-team-balancer-link" },
  { to: "/matches", label: "Matches", icon: Gamepad2, testid: "nav-matches-link" },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy, testid: "nav-leaderboard-link" },
  { to: "/statistics", label: "Statistics", icon: BarChart3, testid: "nav-statistics-link" },
  { to: "/admin", label: "Admin Panel", icon: Shield, testid: "nav-admin-link" },
];

const NavItems = ({ onNavigate }) => (
  <nav className="flex flex-col gap-1 px-3">
    {NAV.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          data-testid={item.testid}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
              isActive
                ? "bg-magma/12 text-magma border-l-2 border-magma"
                : "text-muted-foreground hover:text-white hover:bg-white/5 border-l-2 border-transparent"
            }`
          }
        >
          <Icon size={18} className="shrink-0" />
          <span>{item.label}</span>
        </NavLink>
      );
    })}
  </nav>
);

const Brand = () => (
  <div className="flex items-center gap-2.5 px-5 h-16 border-b border-[#242938]">
    <div className="w-9 h-9 rounded-md flex items-center justify-center gradient-bar magma-glow">
      <Flame size={20} className="text-black" />
    </div>
    <div className="leading-tight">
      <div className="font-display font-extrabold text-lg tracking-tight">
        MUCHO<span className="text-magma">MONEY</span><span className="text-gold">8s</span>
      </div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">COD Ladder</div>
    </div>
  </div>
);

export const Sidebar = () => {
  const { admin } = useData();
  return (
    <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 bg-[#0D0E15] border-r border-[#242938] z-30">
      <Brand />
      <div className="py-4 flex-1 overflow-y-auto">
        <NavItems />
      </div>
      <div className="p-4 border-t border-[#242938]">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Signed as</div>
        <div className="font-mono text-sm text-gold truncate" data-testid="sidebar-signed-as">{admin?.nickname || "Guest · read-only"}</div>
      </div>
    </aside>
  );
};

export const MobileNav = () => {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const current = NAV.find((n) => (n.end ? loc.pathname === "/" : loc.pathname.startsWith(n.to) && n.to !== "/"));
  return (
    <>
      <div className="lg:hidden flex items-center gap-3">
        <button data-testid="mobile-menu-btn" onClick={() => setOpen(true)} className="p-2 rounded-md hover:bg-white/5">
          <Menu size={22} />
        </button>
        <span className="font-display font-bold">{current?.label || "Dashboard"}</span>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-[#0D0E15] border-r border-[#242938] flex flex-col animate-fade-up">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button onClick={() => setOpen(false)} className="p-2" data-testid="mobile-close-btn">
                <X size={20} />
              </button>
            </div>
            <div className="py-4 flex-1 overflow-y-auto">
              <NavItems onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
