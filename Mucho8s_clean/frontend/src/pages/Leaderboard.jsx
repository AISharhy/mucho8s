import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { winRate, computeGameStats, playerForGame } from "@/lib/elo";
import { GAMES } from "@/lib/demoData";
import { PlayerAvatar, EloBadge, MvpBadge, RankBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Medal, Gamepad2 } from "lucide-react";
import { toast } from "sonner";

const COLUMNS = [
  { key: "rank", label: "#", sortable: false },
  { key: "name", label: "Player", sortable: true },
  { key: "division", label: "Rank", sortable: false },
  { key: "currentElo", label: "Current", sortable: true },
  { key: "peakElo", label: "Peak", sortable: true },
  { key: "winRate", label: "Win %", sortable: true },
  { key: "wins", label: "W", sortable: true },
  { key: "losses", label: "L", sortable: true },
  { key: "mvpCount", label: "MVP", sortable: true },
];

export default function Leaderboard() {
  const { players, matches, playerAvatars, discordPlayer } = useData();
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

  const rankingOrder = useMemo(
    () => [...pool].sort(
      (a, b) =>
        Number(b.currentElo || 0) - Number(a.currentElo || 0) ||
        String(a.name || "").localeCompare(String(b.name || ""))
    ),
    [pool]
  );

  const rankById = useMemo(
    () => new Map(rankingOrder.map((player, index) => [player.id, index + 1])),
    [rankingOrder]
  );

  const movementById = useMemo(() => {
    if (game !== "ALL") return new Map();

    const latestMatch = [...(Array.isArray(matches) ? matches : [])]
      .filter(Boolean)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];

    if (!latestMatch?.eloChanges || typeof latestMatch.eloChanges !== "object") {
      return new Map(rankingOrder.map((player) => [player.id, 0]));
    }

    const previousOrder = [...players].sort((a, b) => {
      const previousA = Number(a.currentElo || 0) - Number(latestMatch.eloChanges?.[a.id] || 0);
      const previousB = Number(b.currentElo || 0) - Number(latestMatch.eloChanges?.[b.id] || 0);
      return previousB - previousA || String(a.name || "").localeCompare(String(b.name || ""));
    });

    const previousRankById = new Map(
      previousOrder.map((player, index) => [player.id, index + 1])
    );

    return new Map(
      rankingOrder.map((player, index) => {
        const currentRank = index + 1;
        const previousRank = previousRankById.get(player.id) || currentRank;
        return [player.id, previousRank - currentRank];
      })
    );
  }, [game, matches, players, rankingOrder]);

  const podium = useMemo(
    () => rankingOrder.slice(0, 3),
    [rankingOrder]
  );

  const toggleSort = (key) => {
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir("desc");
    }
  };

  const exportCsv = () => {
    const header = ["Rank", "Name", "Current Elo", "Peak Elo", "Win Rate", "Wins", "Losses", "MVP Count"];
    const rows = sorted.map((p) => [rankById.get(p.id) || "—", p.name, p.currentElo, p.peakElo, `${winRate(p)}%`, p.wins, p.losses, p.mvpCount]);
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

      {podium.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {podium.map((p, index) => (
            <Link
              key={p.id}
              to={"/players/" + p.id}
              className={"m8-panel rounded-2xl p-4 relative overflow-hidden group " + (index === 0 ? "m8-podium-first md:-translate-y-1" : "")}
            >
              <div className="absolute right-3 top-3 flex items-center gap-1.5">
                {game === "ALL" && Number(movementById.get(p.id) || 0) !== 0 && (
                  <span
                    className={`h-7 px-2 rounded-lg border inline-flex items-center gap-1 font-mono text-[10px] font-black ${Number(movementById.get(p.id) || 0) > 0
                      ? "text-emerald-400 bg-emerald-500/[0.07] border-emerald-500/15"
                      : "text-red-400 bg-red-500/[0.06] border-red-500/15"}`}
                    title={Number(movementById.get(p.id) || 0) > 0
                      ? `Up ${Math.abs(Number(movementById.get(p.id)))} places`
                      : `Down ${Math.abs(Number(movementById.get(p.id)))} places`}
                  >
                    {Number(movementById.get(p.id) || 0) > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                    {Math.abs(Number(movementById.get(p.id) || 0))}
                  </span>
                )}
                <div className="m8-podium-rank" style={{ color: rankColor(index) }}>
                  {index + 1}
                </div>
              </div>
              <div className="flex items-center gap-3 pr-10">
                <PlayerAvatar
                  name={p.name}
                  elo={p.currentElo}
                  size={index === 0 ? 54 : 48}
                  avatarUrl={playerAvatars[p.id]}
                />
                <div className="min-w-0">
                  <div className="brand-kicker mb-1">{index === 0 ? "Leader" : "Top player"}</div>
                  <div className="font-display font-black text-lg truncate group-hover:text-magma transition-colors">{p.name}</div>
                  <div className="mt-2"><RankBadge elo={p.currentElo} compact /></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="m8-panel-quiet rounded-lg px-2.5 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-[#697181]">Elo</div>
                  <div className="font-mono text-sm font-bold mt-0.5">{p.currentElo}</div>
                </div>
                <div className="m8-panel-quiet rounded-lg px-2.5 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-[#697181]">Win</div>
                  <div className="font-mono text-sm font-bold mt-0.5">{winRate(p)}%</div>
                </div>
                <div className="m8-panel-quiet rounded-lg px-2.5 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-[#697181]">MVP</div>
                  <div className="font-mono text-sm font-bold mt-0.5 text-[#D5A33A]">{p.mvpCount || 0}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="m8-panel rounded-2xl overflow-hidden">
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
                  <td colSpan={9} className="px-4 py-16 text-center text-muted-foreground" data-testid="leaderboard-empty">
                    No matches recorded for {game} yet.
                  </td>
                </tr>
              )}
              {sorted.map((p, i) => (
                <tr
                  key={p.id}
                  data-testid={`leaderboard-row-${p.id}`}
                  className={"border-b transition-colors " + (
                    p.id === discordPlayer?.id
                      ? "border-magma/20 bg-magma/[0.045] hover:bg-magma/[0.065]"
                      : "border-[#1D222C] hover:bg-white/[0.03]"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono font-bold min-w-5"
                        style={{ color: rankColor((rankById.get(p.id) || 1) - 1) }}
                      >
                        {rankById.get(p.id) || "—"}
                      </span>
                      {game === "ALL" && Number(movementById.get(p.id) || 0) !== 0 && (
                        <span
                          className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-black ${Number(movementById.get(p.id) || 0) > 0 ? "text-emerald-400" : "text-red-400"}`}
                          title={Number(movementById.get(p.id) || 0) > 0
                            ? `Up ${Math.abs(Number(movementById.get(p.id)))} places`
                            : `Down ${Math.abs(Number(movementById.get(p.id)))} places`}
                        >
                          {Number(movementById.get(p.id) || 0) > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                          {Math.abs(Number(movementById.get(p.id) || 0))}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/players/${p.id}`} className="flex items-center gap-2.5 hover:text-magma transition-colors">
                      <PlayerAvatar name={p.name} elo={p.currentElo} size={30} avatarUrl={playerAvatars[p.id]} />
                      <span className="font-medium">{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3" data-testid={`leaderboard-rank-${p.id}`}>
                    <RankBadge elo={p.currentElo} compact />
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
