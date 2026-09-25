import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { winRate } from "@/lib/elo";
import { PlayerAvatar, EloBadge, WinRatePill, MvpBadge, Last10 } from "@/components/shared";
import { Users, Gamepad2, Flame, Zap, Swords, ArrowUpRight, Crown, Trophy } from "lucide-react";

const StatCard = ({ icon: Icon, label, value, sub, accent, testid }) => (
  <div className="card-surface rounded-xl p-5 relative overflow-hidden animate-fade-up" data-testid={testid}>
    <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20" style={{ background: accent }} />
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: `${accent}18`, color: accent }}>
        <Icon size={18} />
      </div>
    </div>
    <div className="font-mono text-3xl font-extrabold text-white">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
  </div>
);

export default function Dashboard() {
  const { players, matches, playerMap } = useData();

  const stats = useMemo(() => {
    const highest = [...players].sort((a, b) => b.currentElo - a.currentElo)[0];
    const mostActive = [...players].sort((a, b) => b.totalMatches - a.totalMatches)[0];
    return { highest, mostActive };
  }, [players]);

  const topPlayers = useMemo(
    () => [...players].sort((a, b) => b.currentElo - a.currentElo).slice(0, 5),
    [players]
  );

  const feed = matches.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="card-surface rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="gradient-bar h-1 absolute top-0 left-0 right-0" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold mb-2">Private COD Ladder</div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
              Build the <span className="text-magma">perfect</span> 4v4
            </h2>
            <p className="text-muted-foreground mt-2 max-w-md text-sm">
              Auto-generate the most balanced squads using Peak Elo, Current Elo and historical win rate.
            </p>
          </div>
          <Link
            to="/balancer"
            data-testid="dashboard-balance-cta"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-magma hover:bg-magma/90 text-white font-semibold transition-all magma-glow self-start"
          >
            <Swords size={18} /> Balance Teams <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard icon={Users} label="Total Players" value={players.length} sub="Active roster" accent="#FF2A3B" testid="kpi-total-players" />
        <StatCard icon={Gamepad2} label="Total Matches" value={matches.length} sub="Recorded games" accent="#FFB800" testid="kpi-total-matches" />
        <StatCard icon={Flame} label="Highest Elo" value={stats.highest?.currentElo ?? "—"} sub={stats.highest?.name} accent="#10B981" testid="kpi-highest-elo" />
        <StatCard icon={Zap} label="Most Active" value={stats.mostActive?.totalMatches ?? "—"} sub={stats.mostActive?.name} accent="#3B82F6" testid="kpi-most-active" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Players */}
        <div className="lg:col-span-1 card-surface rounded-xl p-5" data-testid="dashboard-top-players">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-gold" />
            <h3 className="font-display font-bold text-lg">Top Ranked</h3>
          </div>
          <div className="space-y-2">
            {topPlayers.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                <span className="font-mono font-bold w-6 text-center" style={{ color: i === 0 ? "#FFB800" : "#9CA3AF" }}>
                  {i + 1}
                </span>
                <PlayerAvatar name={p.name} elo={p.currentElo} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">WR <WinRatePill player={p} /></div>
                </div>
                <EloBadge elo={p.currentElo} />
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="lg:col-span-2 card-surface rounded-xl p-5" data-testid="dashboard-activity-feed">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={18} className="text-magma" />
            <h3 className="font-display font-bold text-lg">Recent Activity</h3>
          </div>
          <div className="space-y-3">
            {feed.length === 0 && <div className="text-sm text-muted-foreground py-8 text-center">No matches yet.</div>}
            {feed.map((m) => {
              const winIds = m.winner === "A" ? m.teamA : m.teamB;
              const mvp = playerMap[m.mvpId];
              return (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#101219] border border-[#1C202E]">
                  <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: m.winner === "A" ? "rgba(255,42,59,0.15)" : "rgba(255,184,0,0.15)" }}>
                    <Trophy size={16} className={m.winner === "A" ? "text-magma" : "text-gold"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className={m.winner === "A" ? "text-magma font-semibold" : "text-gold font-semibold"}>
                        {m.winner === "A" ? "Alpha" : "Bravo"}
                      </span>{" "}
                      won on <span className="text-white">{m.map || "custom"}</span>
                      <span className="text-muted-foreground"> · {m.mode}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {winIds.map((id) => playerMap[id]?.name).join(", ")}
                    </div>
                  </div>
                  {mvp && (
                    <div className="text-xs flex items-center gap-1 text-gold shrink-0">
                      <Crown size={13} /> {mvp.name}
                    </div>
                  )}
                  <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">
                    {new Date(m.date).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
