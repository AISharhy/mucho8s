import React, { useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Swords, Gamepad2, Trophy, Shield, Menu, X, MessageCircle, LogOut, UserCircle, Bell, BarChart3,
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
  { to: "/challenge-ranking", label: "Chall Ranking", icon: BarChart3, testid: "nav-chall-ranking-link" },
];

const ADMIN_NAV = { to: "/admin", label: "Admin Panel", icon: Shield, testid: "nav-admin-link" };
const ALL_NAV = [
  ...MAIN_NAV,
  ...COMPETITION_NAV,
  { to: "/challenges", label: "Challenge Inbox", icon: Bell },
  ADMIN_NAV,
];

const NavItem = ({ item, onNavigate, badge = 0 }) => {
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
            : "text-[#929BAD] hover:text-white hover:bg-white/[0.03] border-transparent"
        }`
      }
    >
      <Icon size={17} className="shrink-0" />
      <span className="flex-1">{item.label}</span>
      {badge > 0 && (
        <span className="min-w-5 h-5 px-1.5 rounded-full bg-magma text-white text-[10px] font-extrabold flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </NavLink>
  );
};

const NavSection = ({ label, items, onNavigate, badges = {} }) => (
  <div>
    <div className="brand-section-title px-4 mb-2">
      {label}
    </div>
    <nav className="flex flex-col gap-1 px-2">
      {items.map((item) => (
        <NavItem key={item.to} item={item} onNavigate={onNavigate} badge={badges[item.to] || 0} />
      ))}
    </nav>
  </div>
);

const Brand = () => (
  <div className="flex items-center gap-2.5 px-4 h-[72px] border-b border-[#252C39]">
    <div className="w-10 h-10 rounded-xl bg-[#080A0F] border border-[#313B4A] flex items-center justify-center overflow-hidden shrink-0">
      <img
        src={`${process.env.PUBLIC_URL}/logo-mark.svg`}
        alt="MuchoMoney8s"
        className="w-9 h-9 object-contain"
      />
    </div>
    <div className="leading-tight min-w-0">
      <div className="font-display font-extrabold text-[14px] tracking-tight whitespace-nowrap">
        MUCHO<span className="text-magma">MONEY</span><span className="text-white">8s</span>
      </div>
      <div className="text-[9px] uppercase tracking-[0.2em] text-[#697386] mt-1">Competitive COD 8s</div>
    </div>
  </div>
);

const MenuContent = ({ onNavigate, mobile = false }) => {
  const {
    admin,
    discordSession,
    discordAccount,
    discordPlayer,
    discordLoading,
    signInWithDiscord,
    signOutDiscord,
  } = useData();

  const discordName = discordPlayer?.name || discordAccount?.display_name || discordAccount?.discord_username || "Discord";
  const linked = Boolean(discordPlayer);
  const myProfileItem = linked
    ? {
        to: `/players/${discordPlayer.id}`,
        label: "My Profile",
        icon: UserCircle,
        testid: "nav-my-profile-link",
      }
    : null;

  const accountItems = linked ? [myProfileItem] : [];

  return (
    <>
      <div className="py-5 flex-1 overflow-y-auto space-y-6">
        <NavSection label="Main" items={MAIN_NAV} onNavigate={onNavigate} />
        <NavSection label="Competition" items={COMPETITION_NAV} onNavigate={onNavigate} />
        {accountItems.length > 0 && (
          <NavSection
            label="Account"
            items={accountItems}
            onNavigate={onNavigate}
          />
        )}
      </div>

      <div className="px-2 pb-3">
        <div className="h-px bg-[#222938] mb-3" />
        <NavItem item={ADMIN_NAV} onNavigate={onNavigate} />
      </div>

      <div className={`border-t border-[#222938] ${mobile ? "px-3 py-4" : "px-3 py-3"}`}>
        {discordLoading ? (
          <div className="h-11 rounded-xl bg-[#0E1219] border border-[#252C39] flex items-center px-3 text-xs text-muted-foreground">
            Checking Discord session...
          </div>
        ) : discordSession ? (
          <div className="rounded-xl bg-[#0E1219] border border-[#252C39] p-2.5">
            <div className="flex items-center gap-2.5">
              {discordAccount?.avatar_url ? (
                <img
                  src={discordAccount.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#5865F2]/15 border border-[#5865F2]/30 flex items-center justify-center shrink-0">
                  <MessageCircle size={15} className="text-[#9AA4FF]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white truncate" data-testid="sidebar-player-account">
                  {discordName}
                </div>
                <div className={`text-[10px] truncate ${linked ? "text-emerald-400" : "text-[#C9A45C]"}`}>
                  {linked ? `Linked · ${discordPlayer.currentElo} Elo` : "Waiting for player link"}
                </div>
              </div>
              <button
                type="button"
                onClick={signOutDiscord}
                className="w-8 h-8 rounded-lg text-[#697386] hover:text-white hover:bg-white/5 flex items-center justify-center"
                aria-label="Logout Discord"
                data-testid="discord-logout-btn"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={signInWithDiscord}
            className="w-full h-11 rounded-xl bg-[#5865F2] hover:bg-[#6875F5] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            data-testid="discord-login-btn"
          >
            <MessageCircle size={17} /> Login with Discord
          </button>
        )}

        {admin && (
          <div className="flex items-center gap-2 px-1 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-muted-foreground" data-testid="sidebar-signed-as">
              Admin mode active
            </span>
          </div>
        )}
      </div>
    </>
  );
};

export const Sidebar = () => (
  <aside className="hidden lg:flex flex-col w-56 fixed inset-y-0 left-0 bg-[#0A0D13]/95 backdrop-blur-xl border-r border-[#252C39] z-30">
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
            <div className="absolute top-0 bottom-0 left-0 w-64 max-w-[86vw] bg-[#0A0D13] border-r border-[#252C39] flex flex-col shadow-2xl">
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
