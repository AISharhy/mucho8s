import React from "react";
import { RANKS, rankProgress } from "@/lib/elo";
import { Crown, Gem, Shield, Star } from "lucide-react";

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
          rankIndex >= RANKS.length - 1 ? "#FF2A3B" :
          rankIndex >= 9 ? "#D5A33A" :
          "#343B48",
      }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-magma to-transparent opacity-70" />

      <div className="flex items-center gap-3">
        <div
          className={`${compact ? "w-10 h-10" : "w-12 h-12"} shrink-0 rounded-xl border flex items-center justify-center bg-[#151923]`}
          style={{ borderColor: rank.color + "55" }}
        >
          <Icon size={compact ? 18 : 21} style={{ color: rank.color }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            Division {rank.roman}
          </div>
          <div
            className={`font-display font-black uppercase ${compact ? "text-sm" : "text-lg"}`}
            style={{ color: rank.color }}
          >
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
          <div
            className="h-full"
            style={{
              width: `${info.progress}%`,
              background: `linear-gradient(90deg, ${rank.accent}, ${rank.color})`,
            }}
          />
        </div>
      )}
    </div>
  );
};

const RANK_FAMILIES = [
  {
    id: "masters",
    label: "Masters",
    color: "#FF4F68",
    accent: "#8A1730",
    glow: "rgba(255,79,104,.34)",
    min: 2300,
    max: Infinity,
    divisions: ["M"],
  },
  {
    id: "diamond",
    label: "Diamond",
    color: "#9B99FF",
    accent: "#514DB4",
    glow: "rgba(142,140,255,.30)",
    min: 2000,
    max: 2299,
    divisions: ["I", "II", "III"],
  },
  {
    id: "platinum",
    label: "Platinum",
    color: "#5FE2D8",
    accent: "#176A70",
    glow: "rgba(82,200,198,.28)",
    min: 1700,
    max: 1999,
    divisions: ["I", "II", "III"],
  },
  {
    id: "gold",
    label: "Gold",
    color: "#FFD05A",
    accent: "#9B6510",
    glow: "rgba(232,184,63,.30)",
    min: 1400,
    max: 1699,
    divisions: ["I", "II", "III"],
  },
  {
    id: "silver",
    label: "Silver",
    color: "#D6DEE8",
    accent: "#65717F",
    glow: "rgba(185,194,206,.22)",
    min: 1100,
    max: 1399,
    divisions: ["I", "II", "III"],
  },
  {
    id: "bronze",
    label: "Bronze",
    color: "#E18B55",
    accent: "#6C3B22",
    glow: "rgba(193,120,69,.26)",
    min: 800,
    max: 1099,
    divisions: ["I", "II", "III"],
  },
  {
    id: "iron",
    label: "Iron",
    color: "#94A0B1",
    accent: "#434D5C",
    glow: "rgba(124,135,152,.20)",
    min: 500,
    max: 799,
    divisions: ["I", "II", "III"],
  },
];

const PyramidTier = ({ family, index }) => {
  const Icon = iconFor(
    family.id === "masters"
      ? RANKS.length - 1
      : RANKS.findIndex((rank) => rank.id.startsWith(family.id))
  );
  const width = 48 + index * 7.5;

  return (
    <div className="rank-pyramid-step" style={{ width: `${width}%` }}>
      <div
        className={`rank-pyramid-tier rank-pyramid-${family.id}`}
        style={{
          "--rank-color": family.color,
          "--rank-accent": family.accent,
          "--rank-glow": family.glow,
        }}
      >
        <div className="rank-pyramid-shine" />
        <div className="rank-pyramid-icon">
          <Icon size={family.id === "masters" ? 27 : 23} strokeWidth={2.2} />
        </div>

        <div className="rank-pyramid-copy">
          <div className="rank-pyramid-title">{family.label}</div>
          <div className="rank-pyramid-meta">
            <span>{family.divisions.join(" · ")}</span>
            <span className="rank-pyramid-dot">•</span>
            <span>{Number.isFinite(family.max) ? `${family.min}–${family.max} Elo` : `${family.min}+ Elo`}</span>
          </div>
        </div>

        <div className="rank-pyramid-arrow" aria-hidden="true">⌃</div>
      </div>
    </div>
  );
};

export default function RankGuide() {
  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="brand-kicker mb-1">Guida</div>
        <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">
          Come funzionano i Rank
        </h1>
        <p className="text-sm text-[#8D95A4] mt-2 max-w-2xl leading-6">
          Parti da Iron I e scala la piramide fino a Masters. Ogni divisione vale 100 Elo: più sali, più il rank diventa raro e prestigioso.
        </p>
      </section>

      <section className="rank-pyramid-stage rounded-[26px] overflow-hidden">
        <div className="rank-pyramid-ambient rank-pyramid-ambient-left" />
        <div className="rank-pyramid-ambient rank-pyramid-ambient-right" />
        <div className="rank-pyramid-grid" />

        <div className="relative z-10 px-3 sm:px-6 lg:px-10 py-7 sm:py-9">
          <div className="text-center mb-6">
            <div className="brand-kicker text-[#C9AF7A] mb-1">Rank Ladder</div>
            <h2 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.03em]">
              Scala la piramide
            </h2>
            <p className="text-xs sm:text-sm text-[#818A99] mt-1.5">
              Da Iron a Masters. Ogni gradino ti porta più vicino alla cima.
            </p>
          </div>

          <div className="rank-pyramid-wrap">
            {RANK_FAMILIES.map((family, index) => (
              <React.Fragment key={family.id}>
                <PyramidTier family={family} index={index} />
                {index < RANK_FAMILIES.length - 1 && (
                  <div className="rank-pyramid-connector" aria-hidden="true">
                    <span />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="rank-pyramid-base-glow" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-8">
            <div className="rank-guide-info-card">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Start</div>
              <div className="font-display font-black text-lg mt-1">500 Elo · Iron I</div>
              <div className="text-xs text-muted-foreground mt-1">Il punto di partenza della ladder.</div>
            </div>

            <div className="rank-guide-info-card">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Promozione</div>
              <div className="font-display font-black text-lg mt-1">+100 Elo</div>
              <div className="text-xs text-muted-foreground mt-1">Ogni 100 Elo sali di una divisione.</div>
            </div>

            <div className="rank-guide-info-card rank-guide-info-card-top">
              <div className="text-[10px] uppercase tracking-widest text-[#D5A33A]">Cima</div>
              <div className="font-display font-black text-lg mt-1 text-[#FF6A7F]">Masters · 2300+</div>
              <div className="text-xs text-muted-foreground mt-1">Il rank massimo della ladder Mucho8s.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
