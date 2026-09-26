import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, MvpBadge, RankBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Medal } from "lucide-react";
import { toast } from "sonner";

const euro = (value) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const COLUMNS = [
  { key: "rank", label: "#", sortable: false },
  { key: "name", label: "Player", sortable: true },
  { key: "division", label: "Rank", sortable: false },
  { key: "totalPoints", label: "Points", sortable: true },
  { key: "matchWins", label: "Match", sortable: true },
  { key: "challWins", label: "Challs", sortable: true },
  { key: "challPoints", label: "Chall +/-", sortable: true },
  { key: "moneyWon", label: "Won", sortable: true },
  { key: "mvpCount", label: "MVP", sortable: true },
];

export default function Leaderboard() {
  const {
    players,
    playerAvatars,
    discordPlayer,
    publicChallenges,
    competitionData,
  } = useData();

  const [sortKey, setSortKey] = useState("totalPoints");
  const [dir, setDir] = useState("desc");

  const currentSeason = Number(competitionData?.current?.season_number || 1);

  const challStatsById = useMemo(() => {
    const stats = new Map();

    (players || []).forEach((player) => {
      stats.set(player.id, {
        wins: 0,
        losses: 0,
        points: 0,
        moneyWon: 0,
        moneyLost: 0,
      });
    });

    (publicChallenges || []).forEach((challenge) => {
      if (Number(challenge.season_number || 1) !== currentSeason) return;

      const verified = Boolean(
        challenge.verified_at &&
        challenge.status === "completed" &&
        challenge.reported_winner_player_id
      );
      const openDispute = Boolean(
        challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at
      );
      if (!verified || openDispute) return;

      const amount = Number(challenge.amount_cents || 0) / 100;
      const ids = [
        challenge.challenger_player_id,
        challenge.challenged_player_id,
      ];

      ids.forEach((id) => {
        if (!stats.has(id)) {
          stats.set(id, {
            wins: 0,
            losses: 0,
            points: 0,
            moneyWon: 0,
            moneyLost: 0,
          });
        }

        const row = stats.get(id);
        if (challenge.reported_winner_player_id === id) {
          row.wins += 1;
          row.points += amount;
          row.moneyWon += amount;
        } else {
          row.losses += 1;
          row.points -= amount;
          row.moneyLost += amount;
        }
      });
    });

    return stats;
  }, [players, publicChallenges, currentSeason]);

  const rows = useMemo(
    () =>
      (players || []).map((player) => {
        const chall = challStatsById.get(player.id) || {
          wins: 0,
          losses: 0,
          points: 0,
          moneyWon: 0,
          moneyLost: 0,
        };

        return {
          ...player,
          matchWins: Number(player.wins || 0),
          matchLosses: Number(player.losses || 0),
          challWins: chall.wins,
          challLosses: chall.losses,
          challPoints: chall.points,
          moneyWon: chall.moneyWon,
          moneyLost: chall.moneyLost,
          totalPoints: Number(player.currentElo || 0),
        };
      }),
    [players, challStatsById]
  );

  const rankingOrder = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          Number(b.totalPoints || 0) - Number(a.totalPoints || 0) ||
          Number(b.currentElo || 0) - Number(a.currentElo || 0) ||
          String(a.name || "").localeCompare(String(b.name || ""))
      ),
    [rows]
  );

  const rankById = useMemo(
    () => new Map(rankingOrder.map((player, index) => [player.id, index + 1])),
    [rankingOrder]
  );

  const sorted = useMemo(() => {
    const value = (p) => {
      if (sortKey === "matchWins") return p.matchWins;
      if (sortKey === "challWins") return p.challWins;
      return Number(p[sortKey] || 0);
    };

    return [...rows].sort((a, b) => {
      if (sortKey === "name") {
        return dir === "asc"
          ? String(a.name || "").localeCompare(String(b.name || ""))
          : String(b.name || "").localeCompare(String(a.name || ""));
      }

      const difference =
        dir === "asc" ? value(a) - value(b) : value(b) - value(a);

      return (
        difference ||
        (rankById.get(a.id) || 9999) - (rankById.get(b.id) || 9999)
      );
    });
  }, [rows, sortKey, dir, rankById]);

  const podium = useMemo(() => rankingOrder.slice(0, 3), [rankingOrder]);

  const toggleSort = (key) => {
    if (key === sortKey) setDir((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir("desc");
    }
  };

  const exportCsv = () => {
    const header = [
      "Rank",
      "Name",
      "Total Points",
      "General Elo",
      "Match Record",
      "Chall Record",
      "Chall Points",
      "Money Won",
      "Money Lost",
      "MVP",
    ];

    const csvRows = rankingOrder.map((p) => [
      rankById.get(p.id) || "—",
      p.name,
      p.totalPoints,
      p.currentElo,
      `${p.matchWins}W-${p.matchLosses}L`,
      `${p.challWins}W-${p.challLosses}L`,
      p.challPoints,
      p.moneyWon,
      p.moneyLost,
      p.mvpCount || 0,
    ]);

    const csv = [header, ...csvRows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "muchomoney8s_leaderboard.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Leaderboard exported as CSV");
  };

  const rankColor = (index) =>
    index === 0
      ? "#FFB800"
      : index === 1
        ? "#C0C0C0"
        : index === 2
          ? "#CD7F32"
          : "#9CA3AF";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="brand-kicker mb-1">Standings</div>
          <div className="flex items-center gap-2">
            <Medal size={18} className="text-[#D5A33A]" />
            <h3 className="font-display text-xl font-bold" data-testid="leaderboard-title">
              Global Leaderboard
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            General Elo includes Money Chall results: every €1 won adds 1 Elo point and every €1 lost removes 1.
          </p>
        </div>

        <Button
          onClick={exportCsv}
          data-testid="export-csv-btn"
          className="w-full sm:w-auto rounded-xl bg-[#0F1218] border border-[#222834] text-[#C8CED8] hover:bg-white/[0.04]"
        >
          <Download size={16} className="mr-1" /> Export CSV
        </Button>
      </div>

      {podium.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {podium.map((p, index) => (
            <Link
              key={p.id}
              to={"/players/" + p.id}
              className={"m8-panel rounded-2xl p-4 relative overflow-hidden group " + (index === 0 ? "m8-podium-first md:-translate-y-1" : "")}
            >
              <div className="absolute right-3 top-3">
                <div className="m8-podium-rank" style={{ color: rankColor(index) }}>
                  {index + 1}
                </div>
              </div>

              <div className="flex items-center gap-3 pr-10">
                <PlayerAvatar
                  name={p.name}
                  elo={p.totalPoints}
                  size={index === 0 ? 54 : 48}
                  avatarUrl={playerAvatars[p.id]}
                />
                <div className="min-w-0">
                  <div className="brand-kicker mb-1">{index === 0 ? "Leader" : "Top player"}</div>
                  <div className="font-display font-black text-lg truncate group-hover:text-magma transition-colors">
                    {p.name}
                  </div>
                  <div className="mt-2">
                    <RankBadge elo={p.totalPoints} compact />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="m8-panel-quiet rounded-lg px-2.5 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-[#697181]">Points</div>
                  <div className="font-mono text-sm font-bold mt-0.5">{Number(p.totalPoints).toFixed(Number.isInteger(p.totalPoints) ? 0 : 1)}</div>
                </div>
                <div className="m8-panel-quiet rounded-lg px-2.5 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-[#697181]">Match</div>
                  <div className="font-mono text-sm font-bold mt-0.5">{p.matchWins}W-{p.matchLosses}L</div>
                </div>
                <div className="m8-panel-quiet rounded-lg px-2.5 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-[#697181]">Challs</div>
                  <div className="font-mono text-sm font-bold mt-0.5">{p.challWins}W-{p.challLosses}L</div>
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
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    onClick={() => column.sortable && toggleSort(column.key)}
                    data-testid={`sort-${column.key}`}
                    className={`px-4 py-3 text-left text-[11px] uppercase tracking-widest text-muted-foreground font-semibold ${
                      column.sortable ? "cursor-pointer hover:text-white select-none" : ""
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {column.label}
                      {column.sortable &&
                        (sortKey === column.key ? (
                          dir === "asc"
                            ? <ArrowUp size={12} className="text-magma" />
                            : <ArrowDown size={12} className="text-magma" />
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
                  <td colSpan={COLUMNS.length} className="px-4 py-16 text-center text-muted-foreground">
                    No players available.
                  </td>
                </tr>
              )}

              {sorted.map((p) => {
                const challTone =
                  p.challPoints > 0
                    ? "text-emerald-400"
                    : p.challPoints < 0
                      ? "text-red-400"
                      : "text-muted-foreground";

                return (
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
                      <span
                        className="font-mono font-bold min-w-5"
                        style={{ color: rankColor((rankById.get(p.id) || 1) - 1) }}
                      >
                        {rankById.get(p.id) || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <Link to={`/players/${p.id}`} className="flex items-center gap-2.5 hover:text-magma transition-colors">
                        <PlayerAvatar
                          name={p.name}
                          elo={p.totalPoints}
                          size={30}
                          avatarUrl={playerAvatars[p.id]}
                        />
                        <span className="font-medium">{p.name}</span>
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      <RankBadge elo={p.totalPoints} compact />
                    </td>

                    <td className="px-4 py-3 font-mono font-black">
                      {Number(p.totalPoints).toFixed(Number.isInteger(p.totalPoints) ? 0 : 1)}
                    </td>

                    <td className="px-4 py-3 font-mono">
                      <span className="text-emerald-400">{p.matchWins}W</span>
                      <span className="text-[#596170] mx-1">-</span>
                      <span className="text-red-400">{p.matchLosses}L</span>
                    </td>

                    <td className="px-4 py-3 font-mono">
                      <span className="text-emerald-400">{p.challWins}W</span>
                      <span className="text-[#596170] mx-1">-</span>
                      <span className="text-red-400">{p.challLosses}L</span>
                    </td>

                    <td className={`px-4 py-3 font-mono font-bold ${challTone}`}>
                      {p.challPoints > 0 ? "+" : ""}
                      {Number(p.challPoints).toFixed(Number.isInteger(p.challPoints) ? 0 : 2)}
                    </td>

                    <td className="px-4 py-3 font-mono font-semibold text-emerald-400">
                      {euro(p.moneyWon)}
                    </td>

                    <td className="px-4 py-3">
                      <MvpBadge count={p.mvpCount} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
