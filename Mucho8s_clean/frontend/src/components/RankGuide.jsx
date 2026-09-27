import React from "react";
import { RANKS, rankProgress } from "@/lib/elo";
import {
  Shield,
  Star,
  Crown,
  Gem,
  Swords,
  Trophy,
  Flame,
  Scale,
  CheckCircle2,
} from "lucide-react";
import ModeBadge from "@/components/ModeBadge";

const iconFor = (index) => {
  if (index >= 5) return Crown;
  if (index >= 3) return Gem;
  if (index >= 2) return Star;
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
          <div
            className="h-full bg-magma"
            style={{ width: `${info.progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

const Rule = ({ icon: Icon, title, value, text, accent = "text-white" }) => (
  <div className="rounded-xl border border-[#222834] bg-[#0F1218] p-4">
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg border border-[#2A303B] bg-[#151923] flex items-center justify-center shrink-0">
        <Icon size={15} className={accent} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
        <div className={`font-mono font-black text-base mt-0.5 ${accent}`}>{value}</div>
      </div>
    </div>
    <div className="text-[11px] leading-5 text-muted-foreground mt-3">{text}</div>
  </div>
);

export default function RankGuide() {
  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="brand-kicker mb-1">Guide</div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">
              Mucho at a glance
            </h1>
            <p className="text-sm text-[#7F8795] mt-2">
              Modes, Elo, trophies and ranks. Nothing else you need to memorize.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#697181]">
            <CheckCircle2 size={14} className="text-emerald-400" />
            Verified results only
          </div>
        </div>
      </section>

      <section>
        <div className="brand-kicker mb-2">Modes</div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
          {[
            ["mucho8s", "Live", "Team money matches"],
            ["mucho1v1", "Live", "Direct money 1v1"],
            ["muchoranked", "Soon", "Ranked queue · BO1"],
            ["muchotourney", "Soon", "Tournament events"],
          ].map(([mode, status, text]) => (
            <div key={mode} className="rounded-xl border border-[#222834] bg-[#0F1218] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <ModeBadge mode={mode} compact />
                <span className="text-[8px] uppercase tracking-widest text-[#697181]">
                  {status}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">{text}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="brand-kicker mb-2">Mucho8s rules</div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <Rule
            icon={Swords}
            title="Verified result"
            value="+25 / -25"
            text="Base Elo change for a verified Mucho8s result."
            accent="text-magma"
          />
          <Rule
            icon={Scale}
            title="Money pairing"
            value="± stake"
            text="Pairing value is added to the Elo result. €5 means +30 / -30."
            accent="text-emerald-400"
          />
          <Rule
            icon={Trophy}
            title="MVP"
            value="3W = +3 Elo"
            text="Every 3-win milestone gives one Trophy8s MVP."
            accent="text-magma"
          />
          <Rule
            icon={Flame}
            title="MERDA"
            value="3L = 💩"
            text="Every 3 losses adds one. Every 3-win milestone removes one."
            accent="text-[#C79A6B]"
          />
        </div>
      </section>

      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="min-w-0 flex-1">
            <div className="brand-kicker mb-1">Trophies</div>
            <h2 className="font-display text-xl font-black">One family per mode</h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              A new Trophy unlock gives <strong className="text-white">+3 Elo</strong>.
              Multiple unlocks in the same verified match stack with no cap, and each Trophy rewards Elo only once.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {[
              ["Trophy8s", "text-magma border-magma/25 bg-magma/[0.06]"],
              ["Trophy1v1", "text-emerald-400 border-emerald-500/25 bg-emerald-500/[0.06]"],
              ["TrophyRanked", "text-[#4F8CFF] border-[#4F8CFF]/25 bg-[#4F8CFF]/[0.06]"],
              ["TrophyTourney", "text-[#D5A33A] border-[#D5A33A]/25 bg-[#D5A33A]/[0.06]"],
            ].map(([name, classes]) => (
              <span
                key={name}
                className={`h-8 px-3 rounded-lg border inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider ${classes}`}
              >
                <Trophy size={11} />
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[#1D222C] text-[10px] text-[#697181]">
          Mucho8s Points are separate from Elo and Trophy unlocks.
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-3 mb-2">
          <div>
            <div className="brand-kicker mb-1">Ranks</div>
            <h2 className="font-display text-xl font-black">Elo divisions</h2>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            500 → 1350+
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {RANKS.map((rank, index) => {
            const Icon = iconFor(index);
            const next = RANKS[index + 1];

            return (
              <div
                key={rank.id}
                className="rounded-xl border bg-[#0F1218] p-3"
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
      </section>
    </div>
  );
}
