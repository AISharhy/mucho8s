import React, { useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Swords, Gamepad2, Trophy, Shield, Menu, X,
} from "lucide-react";
import { useData } from "@/context/DataContext";

const MAIN_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, testid: "nav-dashboard-link" },
  { to: "/players", label: "Players", icon: Users, testid: "nav-players-link" },
  { to: "/matches", label: "Matches", icon: Gamepad2, testid: "nav-matches-link" },
  { to: "/balancer", label: "Team Balancer", icon: Swords, testid: "nav-team-balancer-link" },
];

const COMPETITION_NAV = [
  { to: "/ranking", label: "Ranking", icon: Trophy, testid: "nav-ranking-link" },
];

const ADMIN_NAV = { to: "/admin", label: "Admin Panel", icon: Shield, testid: "nav-admin-link" };
const ALL_NAV = [...MAIN_NAV, ...COMPETITION_NAV, ADMIN_NAV];

const NavItem = ({ item, onNavigate }) => {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      data-testid={item.testid}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border-l-2 ${
          isActive
            ? "bg-white/[0.045] text-white border-magma"
            : "text-muted-foreground hover:text-white hover:bg-white/[0.035] border-transparent"
        }`
      }
    >
      <Icon size={17} className="shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  );
};

const NavSection = ({ label, items, onNavigate }) => (
  <div>
    <div className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5F6678]">
      {label}
    </div>
    <nav className="flex flex-col gap-1 px-2">
      {items.map((item) => (
        <NavItem key={item.to} item={item} onNavigate={onNavigate} />
      ))}
    </nav>
  </div>
);

const Brand = () => (
  <div className="flex items-center gap-2.5 px-4 h-16 border-b border-[#1C202E]">
    <div className="w-9 h-9 rounded-lg flex items-center justify-center gradient-bar magma-glow text-black font-display font-black text-xs tracking-tighter shrink-0">
      M8
    </div>
    <div className="leading-tight min-w-0">
      <div className="font-display font-extrabold text-[15px] tracking-tight whitespace-nowrap">
        MUCHO<span className="text-magma">MONEY</span><span className="text-gold">8s</span>
      </div>
      <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">COD 8s</div>
    </div>
  </div>
);

const MenuContent = ({ onNavigate, mobile = false }) => {
  const { admin } = useData();
  return (
    <>
      <div className="py-5 flex-1 overflow-y-auto space-y-6">
        <NavSection label="Main" items={MAIN_NAV} onNavigate={onNavigate} />
        <NavSection label="Competition" items={COMPETITION_NAV} onNavigate={onNavigate} />
      </div>

      <div className="px-2 pb-3">
        <div className="h-px bg-[#1C202E] mb-3" />
        <NavItem item={ADMIN_NAV} onNavigate={onNavigate} />
      </div>

      <div className={`border-t border-[#1C202E] ${mobile ? "px-4 py-4" : "px-4 py-3"}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${admin ? "bg-emerald-400" : "bg-[#555D6E]"}`} />
          <span className="text-xs text-muted-foreground" data-testid="sidebar-signed-as">
            {admin ? `Admin · ${admin.nickname}` : "Guest"}
          </span>
        </div>
      </div>
    </>
  );
};

export const Sidebar = () => (
  <aside className="hidden lg:flex flex-col w-56 fixed inset-y-0 left-0 bg-[#0D0E15] border-r border-[#1C202E] z-30">
    <Brand />
    <MenuContent />
  </aside>
);

export const MobileNav = () => {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const current = ALL_NAV.find((item) =>
    item.end ? loc.pathname === "/" : loc.pathname.startsWith(item.to) && item.to !== "/"
  );

  return (
    <>
      <div className="lg:hidden flex items-center gap-3 min-w-0">
        <button
          data-testid="mobile-menu-btn"
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 rounded-md hover:bg-white/5"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <span className="font-display font-bold truncate">{current?.label || "MuchoMoney8s"}</span>
      </div>

      {open &&
        createPortal(
          <div className="lg:hidden fixed inset-0 z-[100]">
            <div className="absolute inset-0 bg-black/75" onClick={() => setOpen(false)} />
            <div className="absolute top-0 bottom-0 left-0 w-64 max-w-[86vw] bg-[#0D0E15] border-r border-[#1C202E] flex flex-col shadow-2xl">
              <div className="relative shrink-0">
                <Brand />
                <button
                  onClick={() => setOpen(false)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-white/5"
                  data-testid="mobile-close-btn"
                  aria-label="Close menu"
                >
                  <X size={19} />
                </button>
              </div>
              <MenuContent onNavigate={() => setOpen(false)} mobile />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
