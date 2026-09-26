import React from "react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";
import { CalendarDays, Trophy, Gamepad2, WalletCards } from "lucide-react";

const euro = (cents) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(cents || 0) / 100);

export default function SeasonHistory() {
  const { competitionData, playerAvatars } = useData();
  const current = competitionData?.current || { season_number: 1, season_name: "Season 1" };
  const archives = competitionData?.archives || [];

  return (
    <div className="m8-page-stack">
      <div className="m8-rank-spotlight rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="brand-kicker mb-1">Current Competition</div>
            <h3 className="font-display text-2xl font-extrabold">{current.season_name || `Season ${current.season_number}`}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Started {current.season_started_at ? new Date(current.season_started_at).toLocaleDateString() : "—"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-magma/10 border border-magma/20 flex items-center justify-center">
            <CalendarDays size={21} className="text-magma" />
          </div>
        </div>
      </div>

      {archives.length === 0 ? (
        <div className="m8-panel rounded-2xl p-10 text-center text-muted-foreground">
          No archived seasons yet.
        </div>
      ) : (
        <div className="space-y-3">
          {archives.map((season) => {
            const players = Array.isArray(season.players) ? season.players : [];
            const matches = Array.isArray(season.matches) ? season.matches : [];
            const top = [...players].sort((a, b) => Number(b.currentElo || 0) - Number(a.currentElo || 0)).slice(0, 3);
            const chall = season.challenge_stats || {};

            return (
              <div key={season.season_number} className="m8-panel rounded-2xl p-5">
                <div className="flex flex-col lg:flex-row lg:items-center gap-5">
                  <div className="lg:w-56 shrink-0">
                    <div className="brand-kicker mb-1">Archived</div>
                    <h3 className="font-display text-xl font-bold">{season.season_name}</h3>
                    <div className="text-xs text-muted-foreground mt-1">
                      Ended {season.ended_at ? new Date(season.ended_at).toLocaleDateString() : "—"}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 flex-1">
                    <div className="m8-stat-card">
                      <Gamepad2 size={15} className="text-magma mb-2" />
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Matches</div>
                      <div className="font-display text-xl font-bold mt-1">{matches.length}</div>
                    </div>
                    <div className="m8-stat-card">
                      <Trophy size={15} className="text-[#D5A33A] mb-2" />
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Challs</div>
                      <div className="font-display text-xl font-bold mt-1">{Number(chall.completed || 0)}</div>
                    </div>
                    <div className="m8-stat-card">
                      <WalletCards size={15} className="text-emerald-400 mb-2" />
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Volume</div>
                      <div className="font-display text-xl font-bold mt-1">{euro(chall.volume_cents)}</div>
                    </div>
                  </div>
                </div>

                {top.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
                    {top.map((player, index) => (
                      <div key={player.id} className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3 flex items-center gap-3">
                        <div className="font-mono text-xs font-bold text-[#D5A33A]">#{index + 1}</div>
                        <PlayerAvatar
                          name={player.name}
                          elo={player.currentElo}
                          size={34}
                          avatarUrl={playerAvatars[player.id]}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{player.name}</div>
                          <div className="text-xs text-muted-foreground">{player.currentElo} Elo</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
