import React from "react";
import { useData } from "@/context/DataContext";
import { RANKS, rankProgress } from "@/lib/elo";
import { RankBadge, RankProgress } from "@/components/shared";
import { Shield, ChevronRight, Trophy } from "lucide-react";

const rangeLabel = (rank) =>
  Number.isFinite(rank.max) ? `${rank.min}–${rank.max} ELO` : `${rank.min}+ ELO`;

export default function RankGuide() {
  const { players, discordPlayer } = useData();
  const previewPlayer =
    discordPlayer ||
    [...players].sort((a, b) => Number(b.currentElo || 0) - Number(a.currentElo || 0))[0] ||
    { name: "Player", currentElo: 1000 };

  const preview = rankProgress(previewPlayer.currentElo);

  return (
    <div className="space-y-5">
      <section className="brand-card rounded-2xl p-5 sm:p-6 overflow-hidden relative">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-center">
          <div>
            <div className="brand-kicker mb-2">Rank Preview</div>
            <h3 className="font-display text-2xl sm:text-3xl font-extrabold">
              {previewPlayer.name} is <span style={{ color: preview.rank.color }}>{preview.rank.name}</span>
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              BO2 League Play-inspired divisions. Your rank is based directly on your current Elo.
            </p>

            <div className="mt-5 max-w-xl">
              <RankProgress elo={previewPlayer.currentElo} />
            </div>

            <div className="mt-3 text-sm text-muted-foreground">
              {preview.next
                ? `You need ${preview.eloNeeded} Elo to reach ${preview.next.name}.`
                : "You reached the highest MuchoMoney8s division."}
            </div>
          </div>

          <div className="rounded-2xl bg-[#0B0D12]/70 border border-[#2A303B] p-5 flex items-center justify-center min-h-[170px]">
            <div className="scale-[1.35] sm:scale-150">
              <RankBadge elo={previewPlayer.currentElo} />
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="brand-kicker mb-1">Division Ladder</div>
          <h3 className="font-display text-xl font-bold">All Ranks</h3>
        </div>
        <Shield size={19} className="text-magma" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {RANKS.map((rank, index) => {
          const next = RANKS[index + 1] || null;

          return (
            <div
              key={rank.id}
              className="card-surface rounded-2xl p-5 relative overflow-hidden"
              style={{ borderColor: `${rank.color}33` }}
            >
              <div
                className="absolute inset-x-0 top-0 h-[2px]"
                style={{ background: `linear-gradient(90deg, transparent, ${rank.color}, transparent)` }}
              />

              <div className="flex items-center gap-4">
                <RankBadge elo={rank.min} showName={false} />
                <div className="min-w-0 flex-1">
                  <div
                    className="font-display text-xl font-black uppercase tracking-[0.12em]"
                    style={{ color: rank.color }}
                  >
                    {rank.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-1">Division {rank.roman}</div>
                  <div className="text-xs text-muted-foreground mt-1">{rank.description}</div>
                </div>
                {index === RANKS.length - 1 && <Trophy size={19} className="text-[#D5A33A]" />}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-5">
                <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Elo Range</div>
                  <div className="font-mono font-bold mt-1">{rangeLabel(rank)}</div>
                </div>
                <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Next Rank</div>
                  <div className="font-mono font-bold mt-1">
                    {next ? `${next.min} ELO` : "MAX"}
                  </div>
                </div>
              </div>

              {next && (
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{rank.name}</span>
                  <ChevronRight size={13} />
                  <span style={{ color: next.color }} className="font-semibold">{next.name}</span>
                  <span className="ml-auto font-mono">{next.min - rank.min} Elo span</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
