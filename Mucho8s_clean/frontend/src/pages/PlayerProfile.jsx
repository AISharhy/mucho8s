import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { winRate, tierOf } from "@/lib/elo";
import { PlayerAvatar, EloBadge, Last10, StreakBadge, MvpBadge } from "@/components/shared";
import { ArrowLeft, Crown, Gamepad2, Target, Trophy, TrendingUp } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis, XAxis, CartesianGrid } from "recharts";

export default function PlayerProfile() {
  const { id } = useParams();
  const { players, matches, playerMap } = useData();

  const player = players.find((p) => p.id === id);

  const playerMatches = useMemo(() => {
    if (!player) return [];
    return matches
      .filter((m) => m.teamA.includes(player.id) || m.teamB.includes(player.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [matches, player]);

  if (!player) {
    return (
      <div className="card-surface rounded-xl p-10 text-center">
        <div className="text-xl font-display font-bold mb-2">Player not found</div>
        <Link to="/players" className="text-magma hover:underline">Back to players</Link>
      </div>
    );
  }

  const tier = tierOf(player.currentElo);
  const stats = [
    { label: "Current Elo", value: player.currentElo, icon: TrendingUp },
    { label: "Peak Elo", value: player.peakElo, icon: Trophy },
    { label: "Matches", value: player.totalMatches, icon: Gamepad2 },
    { label: "Win Rate", value: `${winRate(player)}%`, icon: Target },
    { label: "Wins", value: player.wins },
    { label: "Losses", value: player.losses },
    { label: "MVP", value: player.mvpCount, icon: Crown },
  ];

  return (
    <div className="space-y-6">
      <Link to="/players" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white">
        <ArrowLeft size={16} /> Back to Players
      </Link>

      <div className="card-surface rounded-2xl p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <PlayerAvatar name={player.name} elo={player.currentElo} size={72} />
          <div className="min-w-0">
            <h2 className="font-display text-3xl font-extrabold truncate">{player.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: tier.color }}>{tier.name}</span>
              <EloBadge elo={player.currentElo} />
              <StreakBadge streak={player.currentStreak} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
          {stats.map((item) => (
            <div key={item.label} className="rounded-lg bg-[#101219] border border-[#1C202E] p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.label}</div>
              <div className="font-mono font-bold text-lg mt-1">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Last 10</span>
          <Last10 record={player.last10} />
          <MvpBadge count={player.mvpCount} />
        </div>
      </div>

      <div className="card-surface rounded-xl p-4 sm:p-5">
        <h3 className="font-display font-bold text-lg mb-4">Elo History</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={player.eloHistory || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1C202E" vertical={false} />
              <XAxis dataKey="match" stroke="#4B5563" fontSize={11} />
              <YAxis domain={["dataMin - 30", "dataMax + 30"]} stroke="#4B5563" fontSize={11} width={45} />
              <Tooltip
                contentStyle={{ background: "#12141C", border: "1px solid #242938", borderRadius: 8 }}
                labelStyle={{ color: "#9CA3AF" }}
              />
              <Line type="monotone" dataKey="elo" stroke="#FF2A3B" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-surface rounded-xl p-4 sm:p-5">
        <h3 className="font-display font-bold text-lg mb-4">Recent Matches</h3>
        <div className="space-y-2">
          {playerMatches.slice(0, 10).map((m) => {
            const winners = m.winner === "A" ? m.teamA : m.teamB;
            const won = winners.includes(player.id);
            const teammates = (m.teamA.includes(player.id) ? m.teamA : m.teamB)
              .filter((pid) => pid !== player.id)
              .map((pid) => playerMap[pid]?.name)
              .filter(Boolean);
            const delta = Number(m.eloChanges?.[player.id] || 0);
            return (
              <div key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-lg bg-[#101219] border border-[#1C202E] p-3">
                <div className={`font-bold text-sm ${won ? "text-emerald-400" : "text-red-400"}`}>
                  {won ? "WIN" : "LOSS"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{m.game || "Game"} · {m.mode || "Mode"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    With {teammates.length ? teammates.join(", ") : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {m.mvpId === player.id && <Crown size={15} className="text-gold" />}
                  <span className={`font-mono text-sm ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {delta >= 0 ? "+" : ""}{delta} Elo
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
          {playerMatches.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">No matches recorded for this player yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
