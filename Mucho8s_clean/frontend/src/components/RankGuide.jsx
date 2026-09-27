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
              <span className="text-[10px] text-muted-foreground">Team Elo</span>
            </div>

            <div className="font-mono font-black text-base sm:text-lg mt-4">
              <span className="text-white">dynamic result</span>
              <span className="text-[#596170]"> + </span>
              <span className="text-emerald-400">± stake</span>
              <span className="text-[#596170]"> + </span>
              <span className="text-white">bonuses</span>
            </div>

            <div className="text-[11px] text-muted-foreground mt-3 leading-5">
              Mucho8s compares the <strong className="text-white">average Elo of Alpha vs Bravo</strong>.
              The result part is between <strong className="text-white">5 and 45 Elo</strong>.
              Equal teams are still worth about ±25.
            </div>

            <div className="mt-4 rounded-xl border border-[#242A35] bg-[#090C11] p-3.5">
              <div className="text-[9px] uppercase tracking-widest text-[#697181]">
                Example · Alpha 1050 vs Bravo 1200
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <div className="text-xs text-muted-foreground">Alpha upset win</div>
                  <div className="font-mono font-black text-emerald-400 mt-0.5">
                    about +35 base
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Bravo expected win</div>
                  <div className="font-mono font-black text-emerald-400 mt-0.5">
                    about +15 base
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground mt-3 leading-5">
              After the dynamic result, the personal money pairing is applied 1:1:
              €5 = ±5 Elo, €10 = ±10 Elo, €20 = ±20 Elo.
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-[#0F1218] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <ModeBadge mode="mucho1v1" compact />
              <span className="text-[10px] text-muted-foreground">Direct Elo</span>
            </div>

            <div className="font-mono font-black text-base sm:text-lg mt-4">
              <span className="text-white">player vs player</span>
              <span className="text-[#596170]"> + </span>
              <span className="text-emerald-400">± stake</span>
            </div>

            <div className="text-[11px] text-muted-foreground mt-3 leading-5">
              Mucho1v1 compares the two players directly. Beating a higher-Elo player gives more;
              beating a much lower-Elo player gives less.
            </div>

            <div className="mt-4 rounded-xl border border-[#242A35] bg-[#090C11] p-3.5">
              <div className="text-[9px] uppercase tracking-widest text-[#697181]">
                Example · 1000 Elo vs 1200 Elo · €10
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <div className="text-xs text-muted-foreground">1000 player wins</div>
                  <div className="font-mono font-black text-emerald-400 mt-0.5">
                    about +38 +10 = +48
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">1200 player wins</div>
                  <div className="font-mono font-black text-emerald-400 mt-0.5">
                    about +12 +10 = +22
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
          <div className="text-[9px] uppercase tracking-widest text-[#697181]">
            Full Mucho8s example
          </div>
          <div className="text-sm mt-2 leading-6">
            Alpha has average Elo <strong>1050</strong>, Bravo <strong>1200</strong>.
            Alpha wins, so the upset is worth about
            <span className="font-mono font-black text-white"> +35 Elo</span>.
            With a <strong className="text-emerald-400">€5 pairing</strong> that becomes
            <span className="font-mono font-black text-emerald-400"> +40</span>.
            If it is also your 3rd consecutive Mucho8s win, MVP adds
            <span className="font-mono font-black text-magma"> +5</span>,
            for about <span className="font-mono font-black text-white">+45 Elo</span>.
            Any General Trophy level-up is added after that.
          </div>
        </div>

        <div className="mt-3 text-[10px] text-[#697181]">
          Elo formula: K=50 · scale=400 · result component clamped to 5–45 Elo.
        </div>
      </section>

      <section>
        <div className="brand-kicker mb-2">3 · Streaks</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Rule
            icon={Trophy}
            title="MVP · Mucho8s"
            value="Every 3 wins = +1 MVP +5 Elo"
            text="Mucho8s MVP is repeatable. At 3 straight wins you earn +1 MVP and +5 Elo; at 6 you earn another, then again at 9. Every 3-win milestone also removes 1 active MERDA if you have one."
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
        <div className="brand-kicker mb-1">Mode MVP rules</div>
        <h2 className="font-display text-xl font-black">MVP rewards depend on the mode</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 mt-4">
          {[
            ["mucho8s", "Every 3W", "+5 Elo +1 MVP", "text-magma"],
            ["mucho1v1", "Every 3W", "+3 Elo +1 MVP", "text-emerald-400"],
            ["muchoranked", "Every 3W", "+4 Elo +1 MVP", "text-[#4F8CFF]"],
            ["muchotourney", "Tournament win", "+25 Elo +1 MVP", "text-[#D5A33A]"],
          ].map(([mode, trigger, reward, rewardClass]) => (
            <div key={mode} className="rounded-xl border border-[#222834] bg-[#0F1218] p-3.5">
              <ModeBadge mode={mode} compact />
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-3">
                {trigger}
              </div>
              <div className={`font-mono font-black text-sm mt-1 ${rewardClass}`}>
                {reward}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          MuchoRanked and MuchoTourney rewards become active when those modes go live.
        </p>
      </section>

      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="brand-kicker mb-1">4 · General Trophies</div>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-black">One shared Trophy system</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-6">
              General Trophies are not tied to a mode. Each challenge has <strong className="text-white">10 levels</strong>.
              The target increases with the level: Veteran I is 40 matches, Veteran II is 80, then 120, up to Veteran X at 400.
              Rewards scale with difficulty from <strong className="text-white">+3 to +15 Elo</strong>, and multiple level-ups in the same verified match stack.
            </p>
          </div>
          <span className="h-8 px-3 rounded-lg border border-[#343B48] bg-[#11151C] text-[#C8CED8] inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider">
            <Trophy size={11} /> Lv I → X · +3 to +15 Elo
          </span>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5 mt-4">
          {[
            ["Veteran", "40 matches per level · +5 Elo from Lv I"],
            ["Money Maker", "€50 won per level · +5 Elo from Lv I"],
            ["High Roller", "€20 stake threshold per level · +8 Elo from Lv I"],
            ["Rivalry", "8 meetings per level · +4 Elo from Lv I"],
            ["Nemesis", "4 H2H wins per level · +6 Elo from Lv I"],
            ["Run It Back", "1 comeback per level · +3 Elo from Lv I"],
            ["On Fire", "4 streak wins per level · +6 Elo from Lv I"],
            ["Unstoppable", "8 streak wins per level · +10 Elo from Lv I"],
            ["Clean Sweep", "1 four-win sweep per level · +7 Elo from Lv I"],
          ].map(([name, text]) => (
            <div key={name} className="rounded-xl border border-[#2C333E] bg-[#11151C] p-3">
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
        <div className="brand-kicker mb-1">5 · Trophy identity</div>
        <h2 className="font-display text-xl font-black">General Trophies are neutral</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Veteran, Rivalry, Nemesis, Money Maker and the other progression Trophies use one neutral visual identity.
          Only MVP is color-coded by mode.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-3 mt-4">
          <div className="rounded-xl border border-[#343B48] bg-[#11151C] p-4">
            <div className="flex items-center gap-2 text-[#C8CED8]">
              <Trophy size={15} />
              <span className="font-black text-sm">General Trophy</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-2">
              Neutral color · shared progression · Level I → X
            </div>
          </div>

          <div className="rounded-xl border border-[#222834] bg-[#0F1218] p-4">
            <div className="text-[9px] uppercase tracking-widest text-[#697181] mb-3">
              MVP by mode
            </div>
            <div className="flex flex-wrap gap-2">
              <ModeBadge mode="mucho8s" compact />
              <ModeBadge mode="mucho1v1" compact />
              <ModeBadge mode="muchoranked" compact />
              <ModeBadge mode="muchotourney" compact />
            </div>
          </div>
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
