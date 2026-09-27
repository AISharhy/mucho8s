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
  ArrowRight,
  CircleDollarSign,
  Repeat2,
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
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="brand-kicker mb-1">Guide</div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">
              How Mucho works
            </h1>
            <p className="text-sm text-[#8D95A4] mt-2 max-w-2xl">
              Play a mode, get the result verified, then Elo, streaks and Trophies update automatically.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-emerald-400">
            <CheckCircle2 size={14} />
            Only verified results count
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-5">
          {[
            ["1", "Play", "Choose Mucho8s or Mucho1v1"],
            ["2", "Verify", "The result must become official"],
            ["3", "Update", "Elo, streaks and awards are recalculated"],
          ].map(([step, title, text], index) => (
            <div key={step} className="rounded-xl border border-[#222834] bg-[#0F1218] p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border border-[#343B48] bg-[#151923] flex items-center justify-center font-mono font-black text-xs">
                {step}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display font-black text-sm">{title}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{text}</div>
              </div>
              {index < 2 && <ArrowRight size={13} className="hidden sm:block text-[#596170]" />}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="brand-kicker mb-2">1 · Choose a mode</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-magma/20 bg-magma/[0.025] p-4">
            <div className="flex items-center justify-between gap-2">
              <ModeBadge mode="mucho8s" />
              <span className="text-[8px] uppercase tracking-widest text-emerald-400">Live</span>
            </div>
            <div className="font-display font-black text-base mt-4">Team money matches</div>
            <div className="text-[11px] leading-5 text-muted-foreground mt-2">
              Build the teams, assign each player a money pairing, play the match and report the winner.
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.025] p-4">
            <div className="flex items-center justify-between gap-2">
              <ModeBadge mode="mucho1v1" />
              <span className="text-[8px] uppercase tracking-widest text-emerald-400">Live</span>
            </div>
            <div className="font-display font-black text-base mt-4">Direct money 1v1</div>
            <div className="text-[11px] leading-5 text-muted-foreground mt-2">
              Choose one opponent, the stake and a payment method they linked. They accept, you play, then the result is verified.
            </div>
          </div>

          <div className="rounded-2xl border border-[#4F8CFF]/20 bg-[#4F8CFF]/[0.025] p-4">
            <div className="flex items-center justify-between gap-2">
              <ModeBadge mode="muchoranked" />
              <span className="text-[8px] uppercase tracking-widest text-[#4F8CFF]">Coming Soon</span>
            </div>
            <div className="font-display font-black text-base mt-4">Automatic ranked queue</div>
            <div className="text-[11px] leading-5 text-muted-foreground mt-2">
              Planned as a BO1 ranked queue. Final matchmaking and scoring rules will be shown here when the mode goes live.
            </div>
          </div>

          <div className="rounded-2xl border border-[#D5A33A]/20 bg-[#D5A33A]/[0.025] p-4">
            <div className="flex items-center justify-between gap-2">
              <ModeBadge mode="muchotourney" />
              <span className="text-[8px] uppercase tracking-widest text-[#D5A33A]">Coming Soon</span>
            </div>
            <div className="font-display font-black text-base mt-4">Tournament events</div>
            <div className="text-[11px] leading-5 text-muted-foreground mt-2">
              Brackets and tournament progression will live here. Rules will be added when MuchoTourney is activated.
            </div>
          </div>
        </div>
      </section>

      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="brand-kicker mb-1">2 · Elo</div>
        <h2 className="font-display text-2xl font-black">How your Elo changes</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Mucho8s and Mucho1v1 currently use the same global Elo. The minimum Elo is 500.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-5">
          <div className="rounded-2xl border border-magma/20 bg-[#0F1218] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <ModeBadge mode="mucho8s" compact />
              <span className="text-[10px] text-muted-foreground">Formula</span>
            </div>

            <div className="font-mono font-black text-base sm:text-lg mt-4">
              <span className="text-magma">±25 result</span>
              <span className="text-[#596170]"> + </span>
              <span className="text-emerald-400">± stake</span>
              <span className="text-[#596170]"> + </span>
              <span className="text-white">bonuses</span>
            </div>

            <div className="mt-4 rounded-xl border border-[#242A35] bg-[#090C11] p-3.5">
              <div className="text-[9px] uppercase tracking-widest text-[#697181]">Example · €5 pairing</div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <div className="text-xs text-muted-foreground">Win</div>
                  <div className="font-mono font-black text-emerald-400 mt-0.5">
                    +25 + 5 = +30
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Loss</div>
                  <div className="font-mono font-black text-red-400 mt-0.5">
                    -25 - 5 = -30
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground mt-3 leading-5">
              The stake is converted 1:1 into Elo points for that pairing. A €10 pairing adds ±10, a €20 pairing adds ±20.
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-[#0F1218] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <ModeBadge mode="mucho1v1" compact />
              <span className="text-[10px] text-muted-foreground">Formula</span>
            </div>

            <div className="font-mono font-black text-base sm:text-lg mt-4">
              <span className="text-emerald-400">±25 result</span>
              <span className="text-[#596170]"> + </span>
              <span className="text-white">± stake</span>
            </div>

            <div className="mt-4 rounded-xl border border-[#242A35] bg-[#090C11] p-3.5">
              <div className="text-[9px] uppercase tracking-widest text-[#697181]">Example · €10 Mucho1v1</div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <div className="text-xs text-muted-foreground">Winner</div>
                  <div className="font-mono font-black text-emerald-400 mt-0.5">
                    +25 + 10 = +35
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Loser</div>
                  <div className="font-mono font-black text-red-400 mt-0.5">
                    -25 - 10 = -35
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground mt-3 leading-5">
              Nothing changes until the Mucho1v1 result is verified.
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#2A303B] bg-[#0F1218] p-4">
          <div className="text-[9px] uppercase tracking-widest text-[#697181]">Full Mucho8s example</div>
          <div className="text-sm mt-2 leading-6">
            Win a <strong className="text-white">€5 pairing</strong> on your
            <strong className="text-magma"> 3rd consecutive win</strong>:
            <span className="font-mono font-black text-emerald-400"> +30 Elo</span>
            {" "}for the match + <span className="font-mono font-black text-magma">+3 Elo</span> MVP =
            <span className="font-mono font-black text-white"> +33 Elo</span>.
            If you also unlock a new Trophy8s in that match, add another <strong>+3 Elo per Trophy</strong>.
          </div>
        </div>
      </section>

      <section>
        <div className="brand-kicker mb-2">3 · Streaks</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Rule
            icon={Trophy}
            title="MVP · Trophy8s"
            value="Every 3 wins = +1 MVP +3 Elo"
            text="MVP is repeatable. At 3 straight wins you earn one; at 6 straight wins you earn another; at 9 you earn another. Every 3-win milestone also removes 1 active MERDA if you have one."
            accent="text-magma"
          />
          <Rule
            icon={Flame}
            title="MERDA"
            value="Every 3 losses = +1 💩"
            text="At 3 straight losses you get one MERDA; at 6 you get another. MERDA does not add an extra Elo penalty beyond the normal match loss."
            accent="text-[#C79A6B]"
          />
        </div>
      </section>

      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="brand-kicker mb-1">4 · Trophy8s</div>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-black">One-time achievements</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-6">
              Each new Trophy8s gives <strong className="text-white">+3 Elo once</strong>.
              If the same Mucho8s unlocks multiple new Trophies, every +3 stacks with no cap.
            </p>
          </div>
          <span className="h-8 px-3 rounded-lg border border-magma/25 bg-magma/[0.06] text-magma inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider">
            <Trophy size={11} /> +3 Elo each
          </span>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5 mt-4">
          {[
            ["Veteran", "Play 40 Mucho8s"],
            ["Money Maker", "Win €50 through Mucho8s pairings"],
            ["High Roller", "Win a pairing worth at least €20"],
            ["Rivalry", "Meet the same player 8 times"],
            ["Nemesis", "Beat the same player 4 times"],
            ["Run It Back", "Lose to a player, then beat them next time"],
            ["On Fire", "Reach a 4-win streak"],
            ["Unstoppable", "Reach an 8-win streak"],
            ["Clean Sweep", "Win 4 Mucho8s in a row"],
          ].map(([name, text]) => (
            <div key={name} className="rounded-xl border border-magma/15 bg-magma/[0.025] p-3">
              <div className="font-display font-black text-sm">{name}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{text}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-[#242A35] bg-[#0F1218] p-3.5">
          <div className="flex items-start gap-2.5">
            <CircleDollarSign size={15} className="text-[#8D95A4] mt-0.5 shrink-0" />
            <div>
              <div className="font-bold text-xs">Mucho8s Points are not Elo</div>
              <div className="text-[10px] text-muted-foreground mt-1 leading-5">
                Mucho8s Points come from special match bounties such as Streak Breaker, Giant Killer or Payback.
                They are a separate profile score and do not replace Elo or Trophy bonuses.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="brand-kicker mb-1">5 · Trophy families</div>
        <h2 className="font-display text-xl font-black">Every mode keeps its own awards</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Trophy8s is active now. The other Trophy families will get their own objectives as their modes are completed.
        </p>

        <div className="flex flex-wrap gap-2 mt-4">
          {[
            ["Trophy8s", "text-magma border-magma/25 bg-magma/[0.06]", "Active"],
            ["Trophy1v1", "text-emerald-400 border-emerald-500/25 bg-emerald-500/[0.06]", "Next"],
            ["TrophyRanked", "text-[#4F8CFF] border-[#4F8CFF]/25 bg-[#4F8CFF]/[0.06]", "Soon"],
            ["TrophyTourney", "text-[#D5A33A] border-[#D5A33A]/25 bg-[#D5A33A]/[0.06]", "Soon"],
          ].map(([name, classes, status]) => (
            <span
              key={name}
              className={`h-9 px-3 rounded-lg border inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-wider ${classes}`}
            >
              <Trophy size={11} />
              {name}
              <span className="opacity-55">· {status}</span>
            </span>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-3 mb-2">
          <div>
            <div className="brand-kicker mb-1">6 · Ranks</div>
            <h2 className="font-display text-xl font-black">Your Elo decides the division</h2>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Elo floor · 500
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
                  <div className="text-[9px] text-[#596170] mt-1">
                    Next: {next.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[#222834] bg-[#0F1218] p-4">
        <div className="flex items-start gap-3">
          <Repeat2 size={16} className="text-[#8D95A4] mt-0.5 shrink-0" />
          <div>
            <div className="font-display font-black text-sm">The simple version</div>
            <div className="text-[11px] text-muted-foreground mt-1 leading-5">
              Win verified matches to gain Elo. Stakes increase the Elo movement 1:1.
              Build streaks for MVP, unlock new Trophies for extra Elo, and climb the divisions.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
