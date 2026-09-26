import React from "react";
import { RANKS, rankProgress } from "@/lib/elo";
import { Shield, Star, Crown, Gem, Trophy } from "lucide-react";

const iconFor = (index) => {
  if (index >= 7) return Crown;
  if (index >= 5) return Trophy;
  if (index >= 4) return Gem;
  if (index >= 2) return Star;
  return Shield;
};

export const RankEmblem = ({ elo = 1000, compact = false }) => {
  const info = rankProgress(elo);
  const rank = info.rank;
  const Icon = iconFor(RANKS.findIndex((item) => item.id === rank.id));

  return (
    <div
      className={`relative overflow-hidden border bg-[#0D1016] ${compact ? "rounded-xl px-3 py-2" : "rounded-2xl p-4"}`}
      style={{ borderColor: RANKS.findIndex((item) => item.id === rank.id) >= 7 ? "#FF2A3B" : RANKS.findIndex((item) => item.id === rank.id) >= 4 ? "#D5A33A" : "#343B48" }}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-magma to-transparent opacity-80" />
      <div className="flex items-center gap-3">
        <div
          className={`${compact ? "w-10 h-10" : "w-14 h-14"} shrink-0 rotate-45 rounded-xl border flex items-center justify-center bg-[#151923]`}
          style={{ borderColor: RANKS.findIndex((item) => item.id === rank.id) >= 4 ? "#D5A33A" : "#4A5363" }}
        >
          <div className="-rotate-45 flex flex-col items-center justify-center">
            <Icon size={compact ? 18 : 24} className={RANKS.findIndex((item) => item.id === rank.id) >= 4 ? "text-[#D5A33A]" : "text-white"} />
            <span className="text-[8px] font-black tracking-tighter">{rank.short}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">Rank {rank.roman}</div>
          <div className={`font-display font-black uppercase tracking-wide ${compact ? "text-sm" : "text-xl"}`}>
            {rank.name}
          </div>
          {!compact && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {info.next ? `${info.eloNeeded} Elo to ${info.next.name}` : "Maximum competitive rank"}
            </div>
          )}
        </div>
        <div className="font-mono font-black text-sm">{elo}</div>
      </div>
      {!compact && (
        <div className="mt-3 h-1.5 rounded-full bg-[#1D222C] overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#D5A33A] to-[#FF2A3B]" style={{ width: `${info.progress}%` }} />
        </div>
      )}
    </div>
  );
};

export default function RankGuide() {
  return (
    <div className="space-y-6">
      <div>
        <div className="brand-kicker mb-1">Competitive Divisions</div>
        <h3 className="font-display text-2xl font-extrabold">Rank Ladder</h3>
        <p className="text-sm text-muted-foreground mt-1">
          BO2-inspired competitive ladder. Your Elo determines the emblem shown across MuchoMoney8s.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {RANKS.map((rank, index) => {
          const Icon = iconFor(index);
          const next = RANKS[index + 1];
          return (
            <div key={rank.name} className="card-surface rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-magma to-transparent opacity-70" />
              <div className="w-16 h-16 mx-auto rotate-45 rounded-2xl border border-[#D5A33A]/50 bg-[#0F1218] flex items-center justify-center">
                <div className="-rotate-45 text-center">
                  <Icon size={26} className="mx-auto text-[#D5A33A]" />
                  <div className="text-[9px] font-black mt-0.5">{rank.short}</div>
                </div>
              </div>
              <div className="text-center mt-5">
                <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Division {rank.roman}</div>
                <div className="font-display text-xl font-black uppercase mt-1">{rank.name}</div>
                <div className="font-mono text-sm text-[#D5A33A] mt-2">
                  {next ? `${rank.min} – ${rank.max} ELO` : `${rank.min}+ ELO`}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {next ? `Reach ${next.min} for ${next.name}` : "Highest division"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
