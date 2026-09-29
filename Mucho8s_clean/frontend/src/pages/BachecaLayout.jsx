import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Award, Flame, History, Trophy } from "lucide-react";
import { useData } from "@/context/DataContext";

const TABS = [
  { to: "/bacheca/hall-of-fame", label: "Hall of Fame", icon: Award, tone: "text-[#D5A33A]" },
  { to: "/bacheca/rivalries", label: "Rivalries", icon: Flame, tone: "text-orange-400" },
  { to: "/bacheca/records", label: "Records", icon: Trophy, tone: "text-[#8E98FF]" },
];

export default function BachecaLayout() {
  const { competitionData } = useData();
  const current = competitionData?.current || {};
  const archives = Array.isArray(competitionData?.archives) ? competitionData.archives : [];

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[24px] p-5 sm:p-6 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-50">
          <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-[#D5A33A]/[0.06] blur-3xl" />
          <div className="absolute -bottom-28 left-1/3 w-80 h-80 rounded-full bg-magma/[0.045] blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <div>
            <div className="brand-kicker mb-1">Competition Legacy</div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.045em]">
                Bacheca
              </h1>
              <span className="h-8 px-3 rounded-xl border border-[#D5A33A]/20 bg-[#D5A33A]/[0.055] text-[#D5A33A] inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
                <History size={13} />
                {archives.length} archived
              </span>
            </div>
            <p className="text-sm text-[#7F8795] mt-2 max-w-2xl">
              Rivalries, season trophies and all-time records. This is where the history of MuchoMoney8s stays.
            </p>
          </div>

          <div className="rounded-xl border border-[#242A35] bg-[#0F1218] px-4 py-3 min-w-[220px]">
            <div className="text-[9px] uppercase tracking-[0.16em] text-[#697181]">Current competition</div>
            <div className="font-display font-black mt-1">
              {current?.season_name || `Season ${current?.season_number || 1}`}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Season {Number(current?.season_number ?? 1)} · Hall of Fame locks at rollover
            </div>
          </div>
        </div>

        <nav className="relative z-10 mt-5 flex flex-wrap gap-2" aria-label="Bacheca sections">
          {TABS.map(({ to, label, icon: Icon, tone }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `h-10 px-3.5 rounded-xl border inline-flex items-center gap-2 text-xs font-black transition-all ${
                  isActive
                    ? "bg-white/[0.065] border-[#3A424F] text-white shadow-[inset_0_-2px_0_rgba(255,255,255,.08)]"
                    : "bg-[#0F1218] border-[#222834] text-[#8D95A4] hover:text-white hover:border-[#343B48]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={14} className={isActive ? tone : "text-[#697181]"} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </section>

      <Outlet />
    </div>
  );
}
