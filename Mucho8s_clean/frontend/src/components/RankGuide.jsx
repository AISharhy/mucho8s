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

export default function RankGuide() {
  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="brand-kicker mb-1">Guida</div>
        <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">
          Come funzionano i Rank
        </h1>
        <p className="text-sm text-[#8D95A4] mt-2 max-w-2xl leading-6">
          Parti da Iron I e sali di divisione aumentando il tuo Elo. Ogni divisione richiede 100 Elo; Masters è il rank massimo.
        </p>
      </section>

      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <div className="brand-kicker mb-1">Rank</div>
            <h2 className="font-display text-2xl font-black">Progressione</h2>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Si parte da 500 Elo
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
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
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="m8-panel-quiet rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Inizio</div>
            <div className="font-display font-black text-lg mt-1">500 Elo · Iron I</div>
            <div className="text-xs text-muted-foreground mt-1">Ogni nuova stagione parte dal valore Elo configurato.</div>
          </div>

          <div className="m8-panel-quiet rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Promozione</div>
            <div className="font-display font-black text-lg mt-1">+100 Elo</div>
            <div className="text-xs text-muted-foreground mt-1">Raggiunta la soglia successiva, il rank cambia automaticamente.</div>
          </div>

          <div className="m8-panel-quiet rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Rank massimo</div>
            <div className="font-display font-black text-lg mt-1">Masters · 2300+</div>
            <div className="text-xs text-muted-foreground mt-1">Masters non ha divisioni successive.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
