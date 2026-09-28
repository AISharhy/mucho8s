import React from "react";
import { RANKS, rankProgress } from "@/lib/elo";
import { ArrowRight, Crown, Gem, Shield, Star, TrendingUp } from "lucide-react";

const iconFor = (index) => {
  if (index >= RANKS.length - 1) return Crown;
  if (index >= 15) return Gem;
  if (index >= 9) return Star;
  return Shield;
};

export const RankEmblem = ({ elo = 1000, compact = false }) => {
  const info = rankProgress(elo);
  const rank = info.rank;
  const rankIndex = RANKS.findIndex((item) => item.id === rank.id);
  const Icon = iconFor(rankIndex);

  return (
    <div
      className={`relative overflow-hidden border bg-[#0D1016] ${compact ? "rounded-xl px-3 py-2" : "rounded-2xl p-4"}`}
      style={{
        borderColor:
          rankIndex >= 5 ? "#FF2A3B" :
          rankIndex >= 3 ? "#D5A33A" :
          "#343B48",
      }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-magma to-transparent opacity-70" />

      <div className="flex items-center gap-3">
        <div
          className={`${compact ? "w-10 h-10" : "w-12 h-12"} shrink-0 rounded-xl border flex items-center justify-center bg-[#151923]`}
          style={{ borderColor: rankIndex >= 3 ? "#D5A33A55" : "#4A536355" }}
        >
          <Icon
            size={compact ? 18 : 21}
            className={rankIndex >= 3 ? "text-[#D5A33A]" : "text-white"}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            Division {rank.roman}
          </div>
          <div className={`font-display font-black uppercase ${compact ? "text-sm" : "text-lg"}`}>
            {rank.name}
          </div>
          {!compact && info.next && (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {info.eloNeeded} Elo to {info.next.name}
            </div>
          )}
        </div>

        <div className="font-mono font-black text-sm">{elo}</div>
      </div>

      {!compact && (
        <div className="mt-3 h-1 rounded-full bg-[#1D222C] overflow-hidden">
          <div className="h-full bg-magma" style={{ width: `${info.progress}%` }} />
        </div>
      )}
    </div>
  );
};

const EloExample = ({ left, right, result }) => (
  <div className="rounded-xl border border-[#242A35] bg-[#0F1218] p-3.5">
    <div className="flex items-center gap-2 text-xs">
      <span className="font-mono font-black text-white">{left}</span>
      <span className="text-[#596170]">vs</span>
      <span className="font-mono font-black text-white">{right}</span>
    </div>
    <div className="text-[11px] text-muted-foreground mt-2">{result}</div>
  </div>
);

export default function RankGuide() {
  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="brand-kicker mb-1">Guide</div>
        <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">
          Ranks & Elo
        </h1>
        <p className="text-sm text-[#8D95A4] mt-2 max-w-2xl leading-6">
          Everything you need to know about the MuchoMoney8s rank ladder and how Elo moves after a competitive result.
        </p>
      </section>

      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <div className="brand-kicker mb-1">Ranks</div>
            <h2 className="font-display text-2xl font-black">Rank ladder</h2>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Minimum Elo · 500
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {RANKS.map((rank, index) => {
            const Icon = iconFor(index);
            const next = RANKS[index + 1];

            return (
              <div
                key={rank.id}
                className="rounded-xl border bg-[#0F1218] p-3.5"
                style={{ borderColor: rank.color + "32" }}
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} style={{ color: rank.color }} />
                  <div
                    className="font-display font-black text-sm uppercase truncate"
                    style={{ color: rank.color }}
                  >
                    {rank.name}
                  </div>
                </div>

                <div className="font-mono text-[10px] text-muted-foreground mt-2">
                  {next ? `${rank.min}–${rank.max} Elo` : `${rank.min}+ Elo`}
                </div>

                {next && (
                  <div className="flex items-center gap-1 text-[9px] text-[#596170] mt-1">
                    <span>{next.min - rank.min} Elo range</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-[#242A35] bg-[#0F1218] p-4 mt-3">
          <div className="text-xs text-muted-foreground leading-5">
            Every new official season starts at <strong className="text-white">500 Elo · Iron I</strong>.
            A player enters the leaderboard after playing the first competitive match of that season.
          </div>
        </div>
      </section>

      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-magma" />
          <div className="brand-kicker">Elo</div>
        </div>

        <h2 className="font-display text-2xl font-black mt-2">Dynamic Elo</h2>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-3xl leading-6">
          Elo depends on the strength difference between the two sides. Beating stronger opponents gives more Elo;
          beating weaker opponents gives less. Losing to a weaker opponent costs more Elo.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl border border-[#2A303B] bg-[#11151C] p-4">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Equal strength</div>
            <div className="font-mono font-black text-xl mt-1">≈ ±25</div>
            <div className="text-[10px] text-muted-foreground mt-1">Similar Elo on both sides</div>
          </div>
          <div className="rounded-xl border border-[#2A303B] bg-[#11151C] p-4">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Minimum result</div>
            <div className="font-mono font-black text-xl mt-1">±5</div>
            <div className="text-[10px] text-muted-foreground mt-1">Very expected result</div>
          </div>
          <div className="rounded-xl border border-[#2A303B] bg-[#11151C] p-4">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Maximum result</div>
            <div className="font-mono font-black text-xl mt-1">±45</div>
            <div className="text-[10px] text-muted-foreground mt-1">Major upset</div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-[#343B48] bg-[#11151C] p-4">
          <div className="text-[9px] uppercase tracking-widest text-[#697181]">How it is calculated</div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3 text-sm">
            <div className="font-bold">Mucho8s</div>
            <ArrowRight size={14} className="text-[#596170]" />
            <div className="text-muted-foreground">Average Elo of Team A vs average Elo of Team B</div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3 text-sm">
            <div className="font-bold">Mucho1v1</div>
            <ArrowRight size={14} className="text-[#596170]" />
            <div className="text-muted-foreground">Player Elo vs opponent Elo</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
          <EloExample
            left="950 Bronze II"
            right="1150 Silver I"
            result="If Bronze II wins: about +38 Elo. Silver I loses about −38 Elo."
          />
          <EloExample
            left="1150 Silver I"
            right="950 Bronze II"
            result="If Silver I wins: about +12 Elo. Bronze II loses about −12 Elo."
          />
          <EloExample
            left="1050 Bronze III"
            right="1250 Silver II"
            result="If Bronze III wins: about +38 Elo. Silver II loses about −38 Elo."
          />
          <EloExample
            left="850 Bronze I"
            right="2300 Masters"
            result="A major Bronze I upset against Masters reaches the cap: +45 Elo / −45 Elo."
          />
        </div>

        <div className="text-[10px] text-[#697181] mt-4">
          Formula: K=50 · scale=400 · result component limited to 5–45 Elo.
        </div>
      </section>
    </div>
  );
}
