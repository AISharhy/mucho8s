import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge, WinRatePill } from "@/components/shared";
import { Users, Gamepad2, Flame, Zap, Swords, ArrowUpRight, Crown, Trophy } from "lucide-react";

const StatCard = ({ icon: Icon, label, value, sub, testid }) => (
  <div className="card-surface rounded-2xl p-5 animate-fade-up" data-testid={testid}>
    <div className="flex items-center justify-between mb-5">
      <span className="brand-kicker">{label}</span>
      <div className="w-9 h-9 rounded-lg bg-[#0F1218] border border-[#232935] flex items-center justify-center text-[#AAB1BE]">
        <Icon size={17} />
      </div>
    </div>
    <div className="font-mono text-[30px] leading-none font-bold text-white">{value}</div>
    {sub && <div className="text-xs text-[#7F8795] mt-2 truncate">{sub}</div>}
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
    <div className="space-y-6">
      <section className="brand-card rounded-2xl p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-7">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-[#0B0D12] border border-[#282E39] items-center justify-center shrink-0">
              <img src={`${process.env.PUBLIC_URL}/logo-mark.svg`} alt="" className="w-14 h-14 object-contain" />
            </div>
            <div>
              <div className="brand-kicker mb-2">MuchoMoney8s · Competitive ladder</div>
              <h2 className="font-display text-3xl sm:text-[40px] leading-tight font-extrabold tracking-tight">
                Build a better <span className="text-magma">8s lobby.</span>
              </h2>
              <p className="text-[#9199A7] mt-3 max-w-xl text-sm leading-6">
                Balance teams, track Elo and keep every match in one clean competitive hub.
              </p>
            </div>
          </div>

          <Link
            to="/balancer"
            data-testid="dashboard-balance-cta"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-semibold transition-all magma-glow self-start md:self-center"
          >
            <Swords size={17} /> Balance Teams <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Players" value={players.length} sub="Active roster" testid="kpi-total-players" />
        <StatCard icon={Gamepad2} label="Matches" value={matches.length} sub="Recorded games" testid="kpi-total-matches" />
        <StatCard icon={Flame} label="Highest Elo" value={stats.highest?.currentElo ?? "—"} sub={stats.highest?.name} testid="kpi-highest-elo" />
        <StatCard icon={Zap} label="Most Active" value={stats.mostActive?.totalMatches ?? "—"} sub={stats.mostActive?.name} testid="kpi-most-active" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <section className="lg:col-span-2 card-surface rounded-2xl p-5" data-testid="dashboard-top-players">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="brand-kicker mb-1">Competition</div>
              <h3 className="font-display font-bold text-lg">Top Ranked</h3>
            </div>
            <Trophy size={18} className="text-[#D5A33A]" />
          </div>

          <div className="space-y-1">
            {topPlayers.map((p, i) => (
              <Link
                to={`/players/${p.id}`}
                key={p.id}
                className="interactive-row flex items-center gap-3 p-2.5 rounded-xl"
              >
                <span className={`font-mono text-xs font-bold w-5 text-center ${i === 0 ? "text-[#D5A33A]" : "text-[#6F7786]"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <PlayerAvatar name={p.name} elo={p.currentElo} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">WR <WinRatePill player={p} /></div>
                </div>
                <EloBadge elo={p.currentElo} />
              </Link>
            ))}
          </div>
        </section>

        <section className="lg:col-span-3 card-surface rounded-2xl p-5" data-testid="dashboard-activity-feed">
          <div className="mb-4">
            <div className="brand-kicker mb-1">Timeline</div>
            <h3 className="font-display font-bold text-lg">Recent Activity</h3>
          </div>

          <div className="space-y-2">
            {feed.length === 0 && (
              <div className="text-sm text-muted-foreground py-10 text-center">No matches yet.</div>
            )}

            {feed.map((m) => {
              const winIds = m.winner === "A" ? m.teamA : m.teamB;
              const mvp = playerMap[m.mvpId];

              return (
                <div key={m.id} className="interactive-row flex items-center gap-3 p-3 rounded-xl">
                  <div className="w-9 h-9 rounded-lg bg-magma/10 border border-magma/20 flex items-center justify-center shrink-0">
                    <Trophy size={15} className="text-magma" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      <span className="text-white">{m.winner === "A" ? "Alpha" : "Bravo"}</span>
                      <span className="text-[#717988]"> won · {m.mode || "Match"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {winIds.map((id) => playerMap[id]?.name).filter(Boolean).join(", ")}
                    </div>
                  </div>
                  {mvp && (
                    <div className="hidden sm:flex text-xs items-center gap-1 text-[#D5A33A] shrink-0">
                      <Crown size={12} /> {mvp.name}
                    </div>
                  )}
                  <span className="text-[11px] text-[#697181] shrink-0">
                    {new Date(m.date).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
