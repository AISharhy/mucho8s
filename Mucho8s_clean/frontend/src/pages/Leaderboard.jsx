import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { winRate, computeGameStats, playerForGame } from "@/lib/elo";
import { GAMES } from "@/lib/demoData";
import { PlayerAvatar, EloBadge, MvpBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Medal, Gamepad2 } from "lucide-react";
import { toast } from "sonner";

const COLUMNS = [
  { key: "rank", label: "#", sortable: false },
  { key: "name", label: "Player", sortable: true },
  { key: "currentElo", label: "Current", sortable: true },
  { key: "peakElo", label: "Peak", sortable: true },
  { key: "winRate", label: "Win %", sortable: true },
  { key: "wins", label: "W", sortable: true },
  { key: "losses", label: "L", sortable: true },
  { key: "mvpCount", label: "MVP", sortable: true },
];

export default function Leaderboard() {
  const { players, matches, playerAvatars } = useData();
  const [sortKey, setSortKey] = useState("currentElo");
  const [dir, setDir] = useState("desc");
  const [game, setGame] = useState("ALL");

  // Build the ranking pool: total (aggregate) or per-game (only players who played that game).
  const pool = useMemo(() => {
    if (game === "ALL") return players;
    const gs = computeGameStats(matches, game);
    return players
      .map((p) => playerForGame(p, gs))
      .filter((p) => p.totalMatches > 0);
  }, [players, matches, game]);

  const sorted = useMemo(() => {
    const val = (p) => (sortKey === "winRate" ? winRate(p) : p[sortKey]);
    const arr = [...pool].sort((a, b) => {
      if (sortKey === "name") return dir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      return dir === "asc" ? val(a) - val(b) : val(b) - val(a);
    });
    return arr;
  }, [pool, sortKey, dir]);

  const toggleSort = (key) => {
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir("desc");
    }
  };

  const exportCsv = () => {
    const header = ["Rank", "Name", "Current Elo", "Peak Elo", "Win Rate", "Wins", "Losses", "MVP Count"];
    const rows = sorted.map((p, i) => [i + 1, p.name, p.currentElo, p.peakElo, `${winRate(p)}%`, p.wins, p.losses, p.mvpCount]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `muchomoney8s_leaderboard_${game === "ALL" ? "all" : game}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Leaderboard exported as CSV");
  };

  const rankColor = (i) => (i === 0 ? "#FFB800" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#9CA3AF");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="brand-kicker mb-1">Standings</div>
          <div className="flex items-center gap-2">
            <Medal size={18} className="text-[#D5A33A]" />
            <h3 className="font-display text-xl font-bold" data-testid="leaderboard-title">
              {game === "ALL" ? "Global Ranking" : `${game} Ranking`}
            </h3>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Gamepad2 size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#697181] pointer-events-none" />
            <select
              data-testid="leaderboard-game-select"
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="h-10 w-full sm:w-auto rounded-xl bg-[#0F1218] border border-[#222834] text-[#C8CED8] font-semibold pl-8 pr-3 text-sm"
            >
              <option value="ALL">All Games (Total)</option>
              {GAMES.map((g) => (
                <option key={g} value={g}>{g} only</option>
              ))}
            </select>
          </div>

          <Button
            onClick={exportCsv}
            data-testid="export-csv-btn"
            className="w-full sm:w-auto rounded-xl bg-[#0F1218] border border-[#222834] text-[#C8CED8] hover:bg-white/[0.04]"
          >
            <Download size={16} className="mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="card-surface rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="leaderboard-table">
            <thead>
              <tr className="border-b border-[#222834] bg-[#0F1218]">
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => c.sortable && toggleSort(c.key)}
                    data-testid={`sort-${c.key}`}
                    className={`px-4 py-3 text-left text-[11px] uppercase tracking-widest text-muted-foreground font-semibold ${
                      c.sortable ? "cursor-pointer hover:text-white select-none" : ""
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {c.sortable &&
                        (sortKey === c.key ? (
                          dir === "asc" ? <ArrowUp size={12} className="text-magma" /> : <ArrowDown size={12} className="text-magma" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        ))}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground" data-testid="leaderboard-empty">
                    No matches recorded for {game} yet.
                  </td>
                </tr>
              )}
              {sorted.map((p, i) => (
                <tr
                  key={p.id}
                  data-testid={`leaderboard-row-${p.id}`}
                  className="border-b border-[#1D222C] hover:bg-white/[0.03] transition-colors"
                >
                  <td className="px-4 py-3 font-mono font-bold" style={{ color: rankColor(i) }}>
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/players/${p.id}`} className="flex items-center gap-2.5 hover:text-magma transition-colors">
                      <PlayerAvatar name={p.name} elo={p.currentElo} size={30} avatarUrl={playerAvatars[p.id]} />
                      <span className="font-medium">{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3"><EloBadge elo={p.currentElo} /></td>
                  <td className="px-4 py-3 font-mono text-[#D5A33A]">{p.peakElo}</td>
                  <td className="px-4 py-3 font-mono">{winRate(p)}%</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">{p.wins}</td>
                  <td className="px-4 py-3 font-mono text-red-400">{p.losses}</td>
                  <td className="px-4 py-3"><MvpBadge count={p.mvpCount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
