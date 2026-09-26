import React, { useMemo } from "react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, RankBadge } from "@/components/shared";
import { Trophy, TrendingUp, WalletCards, Swords } from "lucide-react";

const euro = (value) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);

export default function ChallengeLeaderboard() {
  const { players, playerMap, playerAvatars, publicChallenges, competitionData } = useData();
  const currentSeason = Number(competitionData?.current?.season_number || 1);
  const seasonChallenges = publicChallenges.filter(
    (challenge) => Number(challenge.season_number || 1) === currentSeason
  );

  const rows = useMemo(() => {
    const map = new Map();

    players.forEach((player) => {
      map.set(player.id, {
        player,
        wins: 0,
        losses: 0,
        volume: 0,
        profit: 0,
        points: 0,
        played: 0,
        settled: 0,
      });
    });

    seasonChallenges.forEach((challenge) => {
      const amount = Number(challenge.amount_cents || 0) / 100;
      const settled = Boolean(challenge.payment_received_at);
      const ids = [challenge.challenger_player_id, challenge.challenged_player_id];

      ids.forEach((id) => {
        if (!map.has(id)) {
          map.set(id, {
            player: playerMap[id] || { id, name: "Unknown", currentElo: 1000 },
            wins: 0,
            losses: 0,
            volume: 0,
            profit: 0,
            points: 0,
            played: 0,
            settled: 0,
          });
        }

        const row = map.get(id);
        row.played += 1;

        if (challenge.reported_winner_player_id === id) {
          row.wins += 1;
          if (settled) {
            row.profit += amount;
            row.volume += amount;
            row.settled += 1;
          }
        } else {
          row.losses += 1;
          if (settled) {
            row.profit -= amount;
            row.volume += amount;
            row.settled += 1;
          }
        }
      });
    });

    return [...map.values()]
      .filter((row) => row.played > 0)
      .map((row) => ({
        ...row,
        winRate: row.played ? Math.round((row.wins / row.played) * 100) : 0,
      }))
      .sort((a, b) =>
        b.wins - a.wins ||
        b.winRate - a.winRate ||
        b.profit - a.profit
      );
  }, [players, playerMap, seasonChallenges]);

  return (
    <div className="space-y-6">
      <div>
        <div className="brand-kicker mb-1">Competition</div>
        <h2 className="font-display text-3xl font-extrabold">Challenge Leaderboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {competitionData?.current?.season_name || `Season ${currentSeason}`} · W/L includes every verified chall and Money Match Pairing. Ranking prioritizes wins; € profit counts confirmed payouts only.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card-surface rounded-2xl p-10 text-center text-muted-foreground">
          No verified challenges yet.
        </div>
      ) : (
        <div className="card-surface rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-[70px_1fr_105px_105px_105px_105px_105px] gap-3 px-4 py-3 border-b border-[#1D222C] text-[10px] uppercase tracking-widest text-muted-foreground">
            <div>Rank</div>
            <div>Player</div>
            <div className="text-right">Points</div>
            <div className="text-right">Record</div>
            <div className="text-right">Win Rate</div>
            <div className="text-right">Volume</div>
            <div className="text-right">Profit</div>
          </div>

          <div className="divide-y divide-[#1D222C]">
            {rows.map((row, index) => (
              <div
                key={row.player.id}
                className="grid grid-cols-[44px_1fr] md:grid-cols-[70px_1fr_105px_105px_105px_105px_105px] gap-3 items-center px-4 py-4"
              >
                <div className="font-mono font-bold text-lg">
                  {index === 0 ? <Trophy size={18} className="text-[#D5A33A]" /> : `#${index + 1}`}
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <PlayerAvatar
                    name={row.player.name}
                    elo={row.player.currentElo}
                    size={40}
                    avatarUrl={playerAvatars[row.player.id]}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{row.player.name}</div>
                    <div className="mt-1"><RankBadge elo={row.player.currentElo || 1000} compact /></div>
                    <div className="text-xs text-muted-foreground md:hidden mt-1">
                      {row.wins}W - {row.losses}L · {row.winRate}%
                    </div>
                  </div>
                </div>

                <div className={`hidden md:block text-right font-mono font-extrabold ${row.points > 0 ? "text-emerald-400" : row.points < 0 ? "text-red-400" : "text-white"}`}>
                  {row.points > 0 ? "+" : ""}{Number.isInteger(row.points) ? row.points : row.points.toFixed(2)} PT
                </div>
                <div className="hidden md:block text-right font-mono font-semibold">
                  {row.wins}W - {row.losses}L
                </div>
                <div className="hidden md:block text-right font-mono">{row.winRate}%</div>
                <div className="hidden md:block text-right font-mono">{euro(row.volume)}</div>
                <div className={`hidden md:block text-right font-mono font-bold ${row.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {row.profit >= 0 ? "+" : ""}{euro(row.profit)}
                </div>

                <div className="md:hidden col-start-2 grid grid-cols-3 gap-2 mt-1">
                  <div className="rounded-lg bg-[#0F1218] border border-[#1D222C] px-3 py-2">
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Points</div>
                    <div className={`font-mono text-sm font-bold mt-0.5 ${row.points > 0 ? "text-emerald-400" : row.points < 0 ? "text-red-400" : ""}`}>
                      {row.points > 0 ? "+" : ""}{Number.isInteger(row.points) ? row.points : row.points.toFixed(2)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#0F1218] border border-[#1D222C] px-3 py-2">
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Volume</div>
                    <div className="font-mono text-sm mt-0.5">{euro(row.volume)}</div>
                  </div>
                  <div className="rounded-lg bg-[#0F1218] border border-[#1D222C] px-3 py-2">
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Profit</div>
                    <div className={`font-mono text-sm font-bold mt-0.5 ${row.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {row.profit >= 0 ? "+" : ""}{euro(row.profit)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card-surface rounded-2xl p-4">
          <TrendingUp size={18} className="text-emerald-400 mb-2" />
          <div className="text-xs text-muted-foreground">Verified Chall</div>
          <div className="font-display text-2xl font-extrabold mt-1">{seasonChallenges.length}</div>
        </div>
        <div className="card-surface rounded-2xl p-4">
          <Swords size={18} className="text-magma mb-2" />
          <div className="text-xs text-muted-foreground">Money Match Pairings</div>
          <div className="font-display text-2xl font-extrabold mt-1">
            {seasonChallenges.filter((item) => item.source === "match_pairing").length}
          </div>
        </div>
        <div className="card-surface rounded-2xl p-4">
          <WalletCards size={18} className="text-[#D5A33A] mb-2" />
          <div className="text-xs text-muted-foreground">Verified Volume</div>
          <div className="font-display text-2xl font-extrabold mt-1">
            {euro(seasonChallenges.filter((item) => item.payment_received_at).reduce((sum, item) => sum + Number(item.amount_cents || 0) / 100, 0))}
          </div>
        </div>
        <div className="card-surface rounded-2xl p-4">
          <Trophy size={18} className="text-magma mb-2" />
          <div className="text-xs text-muted-foreground">Players Ranked</div>
          <div className="font-display text-2xl font-extrabold mt-1">{rows.length}</div>
        </div>
      </div>
    </div>
  );
}
