import React, { useMemo } from "react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";
import { Trophy, TrendingUp, WalletCards } from "lucide-react";

const euro = (value) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);

export default function ChallengeLeaderboard() {
  const { players, playerMap, playerAvatars, publicChallenges } = useData();

  const rows = useMemo(() => {
    const map = new Map();

    players.forEach((player) => {
      map.set(player.id, {
        player,
        wins: 0,
        losses: 0,
        volume: 0,
        profit: 0,
        played: 0,
      });
    });

    publicChallenges.forEach((challenge) => {
      if (!challenge.payment_received_at) return;
      const amount = Number(challenge.amount_cents || 0) / 100;
      const ids = [challenge.challenger_player_id, challenge.challenged_player_id];

      ids.forEach((id) => {
        if (!map.has(id)) {
          map.set(id, {
            player: playerMap[id] || { id, name: "Unknown", currentElo: 1000 },
            wins: 0,
            losses: 0,
            volume: 0,
            profit: 0,
            played: 0,
          });
        }

        const row = map.get(id);
        row.played += 1;
        row.volume += amount;
        if (challenge.reported_winner_player_id === id) {
          row.wins += 1;
          row.profit += amount;
        } else {
          row.losses += 1;
          row.profit -= amount;
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
        b.profit - a.profit ||
        b.wins - a.wins ||
        b.winRate - a.winRate
      );
  }, [players, playerMap, publicChallenges]);

  return (
    <div className="space-y-6">
      <div>
        <div className="brand-kicker mb-1">Competition</div>
        <h2 className="font-display text-3xl font-extrabold">Challenge Leaderboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Settled challs only. Profit is calculated after the winner confirms the payout received.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card-surface rounded-2xl p-10 text-center text-muted-foreground">
          No verified challenges yet.
        </div>
      ) : (
        <div className="card-surface rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-[70px_1fr_120px_120px_120px_120px] gap-3 px-4 py-3 border-b border-[#252C39] text-[10px] uppercase tracking-widest text-muted-foreground">
            <div>Rank</div>
            <div>Player</div>
            <div className="text-right">Record</div>
            <div className="text-right">Win Rate</div>
            <div className="text-right">Volume</div>
            <div className="text-right">Profit</div>
          </div>

          <div className="divide-y divide-[#252C39]">
            {rows.map((row, index) => (
              <div
                key={row.player.id}
                className="grid grid-cols-[44px_1fr] md:grid-cols-[70px_1fr_120px_120px_120px_120px] gap-3 items-center px-4 py-4"
              >
                <div className="font-mono font-bold text-lg">
                  {index === 0 ? <Trophy size={18} className="text-[#C9A45C]" /> : `#${index + 1}`}
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
                    <div className="text-xs text-muted-foreground md:hidden mt-1">
                      {row.wins}W - {row.losses}L · {row.winRate}%
                    </div>
                  </div>
                </div>

                <div className="hidden md:block text-right font-mono font-semibold">
                  {row.wins}W - {row.losses}L
                </div>
                <div className="hidden md:block text-right font-mono">{row.winRate}%</div>
                <div className="hidden md:block text-right font-mono">{euro(row.volume)}</div>
                <div className={`hidden md:block text-right font-mono font-bold ${row.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {row.profit >= 0 ? "+" : ""}{euro(row.profit)}
                </div>

                <div className="md:hidden col-start-2 grid grid-cols-2 gap-2 mt-1">
                  <div className="rounded-lg bg-[#0E1219] border border-[#252C39] px-3 py-2">
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Volume</div>
                    <div className="font-mono text-sm mt-0.5">{euro(row.volume)}</div>
                  </div>
                  <div className="rounded-lg bg-[#0E1219] border border-[#252C39] px-3 py-2">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card-surface rounded-2xl p-4">
          <TrendingUp size={18} className="text-emerald-400 mb-2" />
          <div className="text-xs text-muted-foreground">Settled Chall</div>
          <div className="font-display text-2xl font-extrabold mt-1">{publicChallenges.filter((item) => item.payment_received_at).length}</div>
        </div>
        <div className="card-surface rounded-2xl p-4">
          <WalletCards size={18} className="text-[#C9A45C] mb-2" />
          <div className="text-xs text-muted-foreground">Verified Volume</div>
          <div className="font-display text-2xl font-extrabold mt-1">
            {euro(publicChallenges.filter((item) => item.payment_received_at).reduce((sum, item) => sum + Number(item.amount_cents || 0) / 100, 0))}
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
