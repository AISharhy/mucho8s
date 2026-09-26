import React from "react";
import { RANKS, rankProgress } from "@/lib/elo";
import {
  Shield,
  Star,
  Crown,
  Gem,
  Swords,
  TrendingUp,
  Trophy,
  Flame,
  Scale,
  CheckCircle2,
} from "lucide-react";

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
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-magma to-transparent opacity-80" />
      <div className="flex items-center gap-3">
        <div
          className={`${compact ? "w-10 h-10" : "w-14 h-14"} shrink-0 rotate-45 rounded-xl border flex items-center justify-center bg-[#151923]`}
          style={{ borderColor: rankIndex >= 3 ? "#D5A33A" : "#4A5363" }}
        >
          <div className="-rotate-45 flex flex-col items-center justify-center">
            <Icon
              size={compact ? 18 : 24}
              className={rankIndex >= 3 ? "text-[#D5A33A]" : "text-white"}
            />
            <span className="text-[8px] font-black tracking-tighter">
              {rank.id === "masters" ? "M" : rank.roman}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Division {rank.roman}
          </div>
          <div className={`font-display font-black uppercase tracking-wide ${compact ? "text-sm" : "text-xl"}`}>
            {rank.name}
          </div>
          {!compact && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {info.next
                ? `${info.eloNeeded} Elo mancanti per ${info.next.name}`
                : "You reached the highest division"}
            </div>
          )}
        </div>

        <div className="font-mono font-black text-sm">{elo}</div>
      </div>

      {!compact && (
        <div className="mt-3 h-1.5 rounded-full bg-[#1D222C] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#D5A33A] to-[#FF2A3B]"
            style={{ width: `${info.progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

const RuleCard = ({ icon: Icon, title, children, accent = "text-magma" }) => (
  <div className="m8-panel rounded-2xl p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#11151C] border border-[#2A303B] flex items-center justify-center shrink-0">
        <Icon size={18} className={accent} />
      </div>
      <div>
        <div className="font-display font-black text-base">{title}</div>
        <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{children}</div>
      </div>
    </div>
  </div>
);

export default function RankGuide() {
  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="brand-kicker mb-1">Competitive Guide</div>
        <h1 className="font-display text-3xl font-black tracking-[-0.03em]">Guide</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
          Here you can see how the ranking works: how you gain or lose Elo,
          how challenge value, MVP, MERDA and rank thresholds affect progression
          through the divisions.
        </p>
      </section>

      <section>
        <div className="brand-kicker mb-2">How Elo changes</div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          <RuleCard icon={Swords} title="Match result">
            Every verified result starts at <strong className="text-white">+25 Elo</strong> for the winner
            and <strong className="text-white">-25 Elo</strong> for the loser.
          </RuleCard>

          <RuleCard icon={TrendingUp} title="Challenge value" accent="text-emerald-400">
            The virtual challenge value is added to the result. With value 5, the base total becomes
            <strong className="text-white"> +30 / -30</strong>; with value 20 it becomes
            <strong className="text-white"> +45 / -45</strong>.
          </RuleCard>

          <RuleCard icon={Trophy} title="MVP 🏆" accent="text-[#D5A33A]">
            MVP is not selected manually: it is awarded automatically every
            <strong className="text-white"> 4 consecutive wins</strong> and vale
            <strong className="text-white"> +3 Elo</strong>. If the streak continues, you receive it again
            alla 8ª, 12ª, 16ª win consecutiva and così via.
          </RuleCard>

          <RuleCard icon={Flame} title="MERDA 💩" accent="text-[#C79A6B]">
            MERDA does not remove Elo. Every <strong className="text-white">4 consecutive losses</strong>
            you receive 1 💩; every <strong className="text-white">4 consecutive wins</strong>
            you remove 1 active 💩.
          </RuleCard>

          <RuleCard icon={CheckCircle2} title="Verified results only" accent="text-emerald-400">
            The ranking changes only when the result is verified and locked.
            Technical Admin changes do not generate player notifications.
          </RuleCard>

          <RuleCard icon={Scale} title="Minimum floor">
            Elo cannot drop below <strong className="text-white">500</strong>.
            Non esistono bonus sorpresa o bonus upset: il calcolo resta leggibile and prevedibile.
          </RuleCard>
        </div>
      </section>

      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="brand-kicker mb-1">Quick examples</div>
        <h2 className="font-display text-xl font-black">How much you gain or lose</h2>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
          {[
            { value: 1, win: 26, loss: -26 },
            { value: 5, win: 30, loss: -30 },
            { value: 12, win: 37, loss: -37 },
            { value: 20, win: 45, loss: -45 },
          ].map((row) => (
            <div key={row.value} className="rounded-xl bg-[#0F1218] border border-[#222834] p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Value {row.value}
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="font-mono font-black text-emerald-400">+{row.win}</span>
                <span className="text-xs text-muted-foreground">win</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="font-mono font-black text-red-400">{row.loss}</span>
                <span className="text-xs text-muted-foreground">loss</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-3">
                Se questa è la 4ª, 8ª, 12ª… win consecutiva, aggiungi +3 Elo MVP.
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="brand-kicker mb-1">Team balancing</div>
        <h2 className="font-display text-xl font-black">How Auto Balance works</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Auto Balance is only used to create more balanced teams: it does not directly change
          Elo. It mainly considers peak Elo, then current Elo and win
          rate. When you choose a game or mode, it also uses history from that specific context;
          the more matches you have in that context, the more that data matters.
        </p>

        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl bg-[#0F1218] border border-[#222834] p-4">
            <div className="font-mono font-black text-lg">60%</div>
            <div className="text-xs text-muted-foreground mt-1">Peak Elo</div>
          </div>
          <div className="rounded-xl bg-[#0F1218] border border-[#222834] p-4">
            <div className="font-mono font-black text-lg">25%</div>
            <div className="text-xs text-muted-foreground mt-1">Current Elo</div>
          </div>
          <div className="rounded-xl bg-[#0F1218] border border-[#222834] p-4">
            <div className="font-mono font-black text-lg">15%</div>
            <div className="text-xs text-muted-foreground mt-1">Win Rate</div>
          </div>
        </div>
      </section>

      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="brand-kicker mb-1">Bounties</div>
        <h2 className="font-display text-xl font-black">Match rewards separated from Elo</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Bounties reward special situations and grant bounty points, but
          <strong className="text-white"> do not change Elo</strong>. They have been
          balanced to be rarer than normal results without affecting the ranking.
        </p>

        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3 mt-4">
          {[
            ["Streak Breaker", "3–6 points", "End an opponent streak of at least 3 wins"],
            ["Duo Breaker", "6 points", "Beat an undefeated duo with at least 3 games together"],
            ["Giant Killer", "5 points", "Win as the underdog"],
            ["Payback", "2 points", "Beat the player who just defeated you"],
            ["Rivalry", "2 points", "Win a close head-to-head matchup"],
          ].map(([title, points, detail]) => (
            <div key={title} className="rounded-xl bg-[#0F1218] border border-[#222834] p-4">
              <div className="font-display font-black text-sm">{title}</div>
              <div className="font-mono text-xs text-[#D5A33A] mt-2">{points}</div>
              <div className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{detail}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="brand-kicker mb-2">Divisions</div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {RANKS.map((rank, index) => {
            const Icon = iconFor(index);
            const next = RANKS[index + 1];

            return (
              <div
                key={rank.name}
                className="m8-panel rounded-2xl p-5 relative overflow-hidden"
                style={{ borderColor: rank.color + "38" }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-[2px] opacity-85"
                  style={{ background: "linear-gradient(90deg, transparent, " + rank.color + ", transparent)" }}
                />

                <div
                  className="w-16 h-16 mx-auto rotate-45 rounded-2xl border bg-[#0F1218] flex items-center justify-center"
                  style={{
                    borderColor: rank.color + "66",
                    boxShadow: "0 10px 28px " + rank.color + "18",
                  }}
                >
                  <div className="-rotate-45 text-center">
                    <Icon size={26} className="mx-auto" style={{ color: rank.color }} />
                    <div className="text-[9px] font-black mt-0.5">
                      {rank.id === "masters" ? "M" : rank.roman}
                    </div>
                  </div>
                </div>

                <div className="text-center mt-5">
                  <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                    Division {rank.roman}
                  </div>
                  <div
                    className="font-display text-xl font-black uppercase mt-1"
                    style={{ color: rank.color }}
                  >
                    {rank.name}
                  </div>
                  <div className="font-mono text-sm mt-2" style={{ color: rank.color }}>
                    {next ? `${rank.min} – ${rank.max} ELO` : `${rank.min}+ ELO`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {next
                      ? `Reach ${next.min} Elo for ${next.name}`
                      : "Division più alta"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="brand-kicker mb-1">Summary</div>
        <h2 className="font-display text-xl font-black">How to climb</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Win verified matches and build positive streaks: every block of 4 consecutive wins
          automatically awards an MVP and +3 Elo. The virtual challenge value increases
          both the gain and the loss by the same amount.
          MERDA is instead a negative-streak indicator and does not change Elo.
        </p>
      </section>
    </div>
  );
}
