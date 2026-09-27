import React, { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import ModeBadge, { isDirectMucho1v1 } from "@/components/ModeBadge";
import { winRate as aggWinRate, BASE_ELO } from "@/lib/elo";
import { GAMES } from "@/lib/demoData";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, RadarChart, PolarGrid, PolarAngleAxis, Radar, Cell,
} from "recharts";
import { TrendingUp, Percent, Activity, Award, Flame, Gamepad2, WalletCards, Coins, Swords, Trophy } from "lucide-react";

const CARD = "m8-panel rounded-2xl p-5";
const tooltipStyle = { background: "#101319", border: "1px solid #242A35", borderRadius: 12 };
const COLORS = ["#FF2A3B", "#D5A33A", "#7E8796", "#C8CED8", "#596170", "#AAB1BE"];

const ChartCard = ({ icon: Icon, title, children, testid, empty }) => (
  <div className={CARD} data-testid={testid}>
    <div className="flex items-center gap-2 mb-4">
      <Icon size={18} className="text-magma" />
      <h3 className="font-display font-bold text-lg">{title}</h3>
    </div>
    <div className="h-64">
      {empty ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data for this game yet.</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      )}
    </div>
  </div>
);

// Build per-player stats from a filtered match list (chronological).
const statsFromMatches = (matches, players) => {
  const chrono = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
  const map = {};
  players.forEach((p) => {
    map[p.id] = { id: p.id, name: p.name, elo: BASE_ELO, peak: BASE_ELO, matches: 0, wins: 0, losses: 0, mvp: 0, history: [{ match: 0, elo: BASE_ELO }] };
  });
  chrono.forEach((m) => {
    const winIds = m.winner === "A" ? m.teamA : m.teamB;
    [...m.teamA, ...m.teamB].forEach((id) => {
      const s = map[id];
      if (!s) return;
      const delta = m.eloChanges?.[id] ?? 0;
      s.elo = Math.max(500, s.elo + delta);
      s.peak = Math.max(s.peak, s.elo);
      s.matches += 1;
      if (winIds.includes(id)) s.wins += 1;
      else s.losses += 1;
      if (id === m.mvpId) s.mvp += 1;
      s.history.push({ match: s.matches, elo: s.elo });
    });
  });
  return Object.values(map)
    .filter((s) => s.matches > 0)
    .map((s) => ({ ...s, wr: s.matches ? Math.round((s.wins / s.matches) * 1000) / 10 : 0 }));
};

export default function Statistics() {
  const { players, matches, publicChallenges, competitionData, playerMap } = useData();
  const [game, setGame] = useState("ALL");

  const gameMatchCounts = useMemo(() => {
    const c = {};
    matches.forEach((m) => { c[m.game] = (c[m.game] || 0) + 1; });
    return c;
  }, [matches]);

  // Unified player stat shape depending on selected game
  const data = useMemo(() => {
    if (game === "ALL") {
      return players.map((p) => ({
        id: p.id,
        name: p.name,
        elo: p.currentElo,
        peak: p.peakElo,
        wr: aggWinRate(p),
        matches: p.totalMatches,
        mvp: p.mvpCount,
        wins: p.wins,
        losses: p.losses,
        history: p.eloHistory,
      }));
    }
    return statsFromMatches(matches.filter((m) => m.game === game), players);
  }, [game, players, matches]);

  const isEmpty = data.length === 0;

  const top5 = useMemo(() => [...data].sort((a, b) => b.elo - a.elo).slice(0, 5), [data]);

  const eloProgression = useMemo(() => {
    const maxLen = Math.max(...top5.map((p) => p.history.length), 0);
    const rows = [];
    for (let i = 0; i < maxLen; i++) {
      const row = { match: i };
      top5.forEach((p) => { row[p.name] = p.history[i]?.elo ?? null; });
      rows.push(row);
    }
    return rows;
  }, [top5]);

  const winRates = useMemo(() => [...data].sort((a, b) => b.wr - a.wr).slice(0, 8).map((p) => ({ name: p.name, wr: p.wr })), [data]);
  const mostActive = useMemo(() => [...data].sort((a, b) => b.matches - a.matches).slice(0, 8).map((p) => ({ name: p.name, matches: p.matches })), [data]);
  const rankings = useMemo(() => [...data].sort((a, b) => b.elo - a.elo).slice(0, 8).map((p) => ({ name: p.name, elo: p.elo })), [data]);

  const radar = useMemo(() => {
    const p = top5[0];
    if (!p) return [];
    return [
      { metric: "Elo", value: Math.min(100, (p.elo / 1600) * 100) },
      { metric: "Peak", value: Math.min(100, (p.peak / 1600) * 100) },
      { metric: "Win %", value: p.wr },
      { metric: "MVP", value: Math.min(100, p.mvp * 6) },
      { metric: "Activity", value: Math.min(100, p.matches * (game === "ALL" ? 1 : 12)) },
    ];
  }, [top5, game]);

  const modeMoneyStats = useMemo(() => {
    const currentSeason = Number(competitionData?.current?.season_number || 1);

    const ensurePlayer = (map, id) => {
      if (!id) return null;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: playerMap[id]?.name || "Unknown",
          mucho8sNet: 0,
          mucho1v1Net: 0,
        });
      }
      return map.get(id);
    };

    const rows = new Map();

    let mucho8sPairings = 0;
    let mucho8sStake = 0;

    (matches || [])
      .filter((match) => Number(match.season || 1) === currentSeason)
      .forEach((match) => {
        const pairings = Array.isArray(match.pairings) ? match.pairings : [];
        pairings.filter(Boolean).forEach((pair) => {
          const amount = Math.max(0, Number(pair.amount || 0));
          if (!pair.playerAId || !pair.playerBId || amount <= 0) return;

          mucho8sPairings += 1;
          mucho8sStake += amount;

          const winnerId = match.winner === "B" ? pair.playerBId : pair.playerAId;
          const loserId = winnerId === pair.playerAId ? pair.playerBId : pair.playerAId;

          const winner = ensurePlayer(rows, winnerId);
          const loser = ensurePlayer(rows, loserId);
          if (winner) winner.mucho8sNet += amount;
          if (loser) loser.mucho8sNet -= amount;
        });
      });

    const direct1v1 = (publicChallenges || []).filter((challenge) => {
      if (Number(challenge.season_number || 1) !== currentSeason) return false;
      if (!isDirectMucho1v1(challenge)) return false;

      const verified = Boolean(
        challenge.status === "completed" &&
        challenge.reported_winner_player_id &&
        challenge.verified_at
      );
      const openDispute = Boolean(
        challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at
      );
      return verified && !openDispute;
    });

    let mucho1v1Stake = 0;
    direct1v1.forEach((challenge) => {
      const amount = Math.max(0, Number(challenge.amount_cents || 0) / 100);
      mucho1v1Stake += amount;

      const winnerId = challenge.reported_winner_player_id;
      const loserId =
        winnerId === challenge.challenger_player_id
          ? challenge.challenged_player_id
          : challenge.challenger_player_id;

      const winner = ensurePlayer(rows, winnerId);
      const loser = ensurePlayer(rows, loserId);
      if (winner) winner.mucho1v1Net += amount;
      if (loser) loser.mucho1v1Net -= amount;
    });

    return {
      seasonName:
        competitionData?.current?.season_name || `Season ${currentSeason}`,
      mucho8s: {
        count: mucho8sPairings,
        stake: mucho8sStake,
      },
      mucho1v1: {
        count: direct1v1.length,
        stake: mucho1v1Stake,
      },
      rows: [...rows.values()].sort(
        (a, b) =>
          Math.abs(b.mucho8sNet) + Math.abs(b.mucho1v1Net) -
          (Math.abs(a.mucho8sNet) + Math.abs(a.mucho1v1Net))
      ),
    };
  }, [matches, publicChallenges, competitionData, playerMap]);

  const games = ["ALL", ...GAMES];

  return (
    <div className="space-y-6">
      {/* Game filter */}
      <div className="m8-panel rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gamepad2 size={16} className="text-[#D5A33A]" />
          <span className="brand-kicker">Filter statistics by game</span>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="stats-game-filter">
          {games.map((g) => {
            const active = game === g;
            const count = g === "ALL" ? matches.length : (gameMatchCounts[g] || 0);
            return (
              <button
                key={g}
                data-testid={`stats-game-${g}`}
                onClick={() => setGame(g)}
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all border ${
                  active ? "bg-white text-black border-white" : "bg-[#0F1218] text-muted-foreground border-[#222834] hover:text-white"
                }`}
              >
                {g === "ALL" ? "All Games" : g}
                <span className={`ml-2 font-mono text-xs ${active ? "text-white/80" : "text-[#D5A33A]"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard icon={TrendingUp} title="Elo Progression (Top 5)" testid="chart-elo-progression" empty={isEmpty}>
          <LineChart data={eloProgression}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1D222C" />
            <XAxis dataKey="match" stroke="#4B5563" fontSize={11} />
            <YAxis stroke="#4B5563" fontSize={11} domain={["dataMin - 40", "dataMax + 40"]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {top5.map((p, i) => (
              <Line key={p.id} type="monotone" dataKey={p.name} stroke={COLORS[i]} strokeWidth={2} dot={false} connectNulls />
            ))}
          </LineChart>
        </ChartCard>

        <ChartCard icon={Percent} title="Top Win Rates" testid="chart-win-rates" empty={isEmpty}>
          <BarChart data={winRates} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1D222C" horizontal={false} />
            <XAxis type="number" stroke="#4B5563" fontSize={11} domain={[0, 100]} />
            <YAxis type="category" dataKey="name" stroke="#4B5563" fontSize={11} width={70} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
            <Bar dataKey="wr" radius={[0, 4, 4, 0]}>
              {winRates.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard icon={Award} title="Player Rankings (Elo)" testid="chart-rankings" empty={isEmpty}>
          <BarChart data={rankings}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1D222C" vertical={false} />
            <XAxis dataKey="name" stroke="#4B5563" fontSize={10} angle={-25} textAnchor="end" height={60} interval={0} />
            <YAxis stroke="#4B5563" fontSize={11} domain={["dataMin - 40", "dataMax + 40"]} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
            <Bar dataKey="elo" fill="#FF2A3B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard icon={Activity} title="Most Active Players" testid="chart-most-active" empty={isEmpty}>
          <BarChart data={mostActive}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1D222C" vertical={false} />
            <XAxis dataKey="name" stroke="#4B5563" fontSize={10} angle={-25} textAnchor="end" height={60} interval={0} />
            <YAxis stroke="#4B5563" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
            <Bar dataKey="matches" fill="#D5A33A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      <section className="space-y-4" data-testid="mode-money-statistics">
        <div>
          <div className="brand-kicker mb-1">Money by mode · {modeMoneyStats.seasonName}</div>
          <h3 className="font-display text-xl font-bold">Mucho Money Split</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Mucho8s uses verified match pairings. Mucho1v1 uses direct verified challenges only.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="m8-panel rounded-2xl p-5 border-magma/20">
            <div className="flex items-center justify-between gap-3">
              <ModeBadge mode="mucho8s" />
              <WalletCards size={18} className="text-emerald-400" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="m8-panel-quiet rounded-xl p-3">
                <div className="brand-kicker">Pairings</div>
                <div className="font-display text-2xl font-black mt-1">
                  {modeMoneyStats.mucho8s.count}
                </div>
              </div>
              <div className="m8-panel-quiet rounded-xl p-3">
                <div className="brand-kicker">Stake Volume</div>
                <div className="font-display text-2xl font-black mt-1 text-emerald-400">
                  €{modeMoneyStats.mucho8s.stake.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="m8-panel rounded-2xl p-5 border-emerald-500/20">
            <div className="flex items-center justify-between gap-3">
              <ModeBadge mode="mucho1v1" />
              <Swords size={18} className="text-emerald-400" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="m8-panel-quiet rounded-xl p-3">
                <div className="brand-kicker">Verified 1v1</div>
                <div className="font-display text-2xl font-black mt-1">
                  {modeMoneyStats.mucho1v1.count}
                </div>
              </div>
              <div className="m8-panel-quiet rounded-xl p-3">
                <div className="brand-kicker">Stake Volume</div>
                <div className="font-display text-2xl font-black mt-1 text-emerald-400">
                  €{modeMoneyStats.mucho1v1.stake.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {modeMoneyStats.rows.length > 0 && (
          <div className="m8-panel rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1fr_110px_110px] gap-3 px-4 py-3 bg-[#0F1218] border-b border-[#1D222C] text-[10px] uppercase tracking-widest text-muted-foreground">
              <div>Player</div>
              <div className="text-right text-[#8D95A4]">Mucho8s</div>
              <div className="text-right text-[#8D95A4]">Mucho1v1</div>
            </div>

            <div className="divide-y divide-[#1D222C]">
              {modeMoneyStats.rows.slice(0, 12).map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[1fr_110px_110px] gap-3 items-center px-4 py-3"
                >
                  <div className="font-semibold truncate">{row.name}</div>

                  <div className="font-mono font-black text-right text-emerald-400">
                    {row.mucho8sNet > 0 ? "+" : row.mucho8sNet < 0 ? "-" : ""}
                    €{Math.abs(row.mucho8sNet).toFixed(2)}
                  </div>

                  <div className="font-mono font-black text-right text-emerald-400">
                    {row.mucho1v1Net > 0 ? "+" : row.mucho1v1Net < 0 ? "-" : ""}
                    €{Math.abs(row.mucho1v1Net).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <ChartCard icon={Flame} title={`Performance Profile — ${top5[0]?.name || "—"}`} testid="chart-radar" empty={isEmpty}>
        <RadarChart data={radar} outerRadius="75%">
          <PolarGrid stroke="#242938" />
          <PolarAngleAxis dataKey="metric" stroke="#9CA3AF" fontSize={12} />
          <Radar dataKey="value" stroke="#FF2A3B" fill="#FF2A3B" fillOpacity={0.35} />
          <Tooltip contentStyle={tooltipStyle} />
        </RadarChart>
      </ChartCard>
    </div>
  );
}
