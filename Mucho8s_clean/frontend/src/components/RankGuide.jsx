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
  UsersRound,
  Landmark,
  Medal,
  Clock3,
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
        <div className="brand-kicker mb-1">Guide</div>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">
              Competitive rules
            </h1>
            <p className="text-sm text-[#7F8795] mt-2 max-w-2xl">
              Mucho modes, Elo, Trophy families, streak rules, team balance and divisions.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#697181]">
            <CheckCircle2 size={14} className="text-emerald-400" />
            Verified results only
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-3 mb-2">
          <div>
            <div className="brand-kicker mb-1">Play ecosystem</div>
            <h2 className="font-display text-xl font-black">Mucho modes</h2>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            One platform · four identities
          </div>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            {
              title: "Mucho8s",
              status: "Live",
              text: "Team money matches with Auto Balance, Captain Draft or Manual teams.",
              icon: UsersRound,
              color: "#FF2A3B",
            },
            {
              title: "Mucho1v1",
              status: "Live",
              text: "Direct money challenge against one player using linked PayPal or Revolut.",
              icon: Landmark,
              color: "#34D399",
            },
            {
              title: "MuchoRanked",
              status: "Coming Soon",
              text: "Automatic ranked queue, BO1 matchmaking and map/mode voting.",
              icon: Medal,
              color: "#4F8CFF",
            },
            {
              title: "MuchoTourney",
              status: "Coming Soon",
              text: "Tournament brackets, team registration, progression and event history.",
              icon: Trophy,
              color: "#D5A33A",
            },
          ].map((mode) => {
            const Icon = mode.icon;
            const coming = mode.status !== "Live";
            return (
              <div
                key={mode.title}
                className="rounded-2xl border bg-[#0F1218] p-4 relative overflow-hidden"
                style={{ borderColor: mode.color + "35" }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-px"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${mode.color}, transparent)`,
                  }}
                />
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="w-10 h-10 rounded-xl border flex items-center justify-center"
                    style={{
                      color: mode.color,
                      borderColor: mode.color + "45",
                      background: mode.color + "0D",
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <span
                    className="h-6 px-2 rounded-lg border inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider"
                    style={{
                      color: mode.color,
                      borderColor: mode.color + "35",
                      background: mode.color + "0D",
                    }}
                  >
                    {coming && <Clock3 size={10} />}
                    {mode.status}
                  </span>
                </div>

                <div className="font-display font-black text-lg mt-3">
                  {mode.title}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1.5 leading-5">
                  {mode.text}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="brand-kicker mb-1">Awards system</div>
        <h2 className="font-display text-xl font-black">Trophy families</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Every mode has its own Trophy identity. Awards never mix between modes.
        </p>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
          {[
            ["Trophy8s", "#FF2A3B", "Mucho8s awards: MVP, MERDA and Mucho8s achievements."],
            ["Trophy1v1", "#34D399", "Reserved for achievements earned only in Mucho1v1."],
            ["TrophyRanked", "#4F8CFF", "Reserved for MuchoRanked milestones and competitive progression."],
            ["TrophyTourney", "#D5A33A", "Reserved for tournament achievements and event results."],
          ].map(([name, color, text]) => (
            <div
              key={name}
              className="rounded-xl border bg-[#0F1218] p-4"
              style={{ borderColor: color + "35" }}
            >
              <div className="flex items-center gap-2">
                <Trophy size={16} style={{ color }} />
                <div className="font-display font-black" style={{ color }}>
                  {name}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground mt-2 leading-5">
                {text}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-[#222834] bg-[#0F1218] px-4 py-3 text-[11px] text-muted-foreground">
          The profile header shows the four Trophy-family counters in the same order:
          <span className="text-magma font-black"> red</span> ·
          <span className="text-emerald-400 font-black"> green</span> ·
          <span className="text-[#4F8CFF] font-black"> blue</span> ·
          <span className="text-[#D5A33A] font-black"> yellow</span>.
          MERDA remains a separate Mucho8s penalty indicator.
        </div>
      </section>

      <section>
        <div className="brand-kicker mb-2">Core rules · Mucho8s</div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Rule
            icon={Swords}
            title="Match result"
            value="+25 / -25"
            text="Every verified team result starts at +25 Elo for the winner and -25 Elo for the loser."
            accent="text-magma"
          />

          <Rule
            icon={Scale}
            title="Money value"
            value="± stake"
            text="The pairing amount is added to the Elo change. A €5 matchup becomes +30 / -30."
            accent="text-emerald-400"
          />

          <Rule
            icon={Trophy}
            title="MVP"
            value="3 W = 🏆 +3"
            text="Every 3 consecutive Mucho8s wins awards 1 MVP, adds it to Trophy8s and gives +3 Elo. At 6 wins you earn another one."
            accent="text-magma"
          />

          <Rule
            icon={Flame}
            title="MERDA"
            value="3 L = 💩"
            text="Every 3 consecutive Mucho8s losses adds 1 MERDA. Every 3-win milestone removes 1 active MERDA. MERDA keeps its own 💩 identity."
            accent="text-[#C79A6B]"
          />
        </div>

        <div className="mt-3 rounded-xl border border-[#222834] bg-[#0F1218] px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-muted-foreground">
          <span><strong className="text-white">500 Elo</strong> minimum floor</span>
          <span>No upset bonus</span>
          <span>No manual MVP selection</span>
          <span>Admin verification locks the result</span>
        </div>
      </section>

      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="brand-kicker mb-1">Trophy8s</div>
        <h2 className="font-display text-xl font-black">Mucho8s achievements</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          These trophies are calculated only from verified Mucho8s history and money pairings.
        </p>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5 mt-4">
          {[
            ["Run It Back", "Lose to a player, then beat them in the next Mucho8s meeting."],
            ["Rivalry", "Meet the same player 8 times in Mucho8s."],
            ["Nemesis", "Beat the same player 4 times in Mucho8s."],
            ["Money Maker", "Win €50 through Mucho8s money pairings."],
            ["High Roller", "Win a Mucho8s pairing worth at least €20."],
            ["Clean Sweep", "Win 4 Mucho8s matches in a row."],
          ].map(([name, text]) => (
            <div key={name} className="rounded-xl border border-magma/15 bg-magma/[0.025] p-3">
              <div className="font-display font-bold text-sm text-magma">{name}</div>
              <div className="text-[11px] text-muted-foreground mt-1 leading-5">{text}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="max-w-xl">
            <div className="brand-kicker mb-1">Auto Balance</div>
            <h2 className="font-display text-xl font-black">Team strength</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-6">
              Auto Balance only builds teams. It does not change Elo. Game and mode history
              become more relevant as more contextual matches are played.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full lg:w-auto lg:min-w-[420px]">
            {[
              ["60%", "Peak Elo"],
              ["25%", "Current"],
              ["15%", "Win Rate"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-[#222834] bg-[#0F1218] px-3 py-4 text-center">
                <div className="font-mono font-black text-lg">{value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-3 mb-2">
          <div>
            <div className="brand-kicker mb-1">Ranks</div>
            <h2 className="font-display text-xl font-black">Divisions</h2>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            500 → 1350+
          </div>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {RANKS.map((rank, index) => {
            const Icon = iconFor(index);
            const next = RANKS[index + 1];

            return (
              <div
                key={rank.id}
                className="rounded-2xl border bg-[#0F1218] p-4 flex items-center gap-3"
                style={{ borderColor: rank.color + "32" }}
              >
                <div
                  className="w-11 h-11 rounded-xl border bg-[#151923] flex items-center justify-center shrink-0"
                  style={{ borderColor: rank.color + "55" }}
                >
                  <Icon size={20} style={{ color: rank.color }} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                    Division {rank.roman}
                  </div>
                  <div className="font-display font-black uppercase" style={{ color: rank.color }}>
                    {rank.name}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono font-black text-xs" style={{ color: rank.color }}>
                    {next ? `${rank.min}–${rank.max}` : `${rank.min}+`}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">
                    Elo
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[#222834] bg-[#0F1218] px-4 py-3">
        <div className="flex items-start gap-3">
          <Trophy size={16} className="text-[#D5A33A] mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-bold">Bounties stay separate</div>
            <div className="text-[11px] text-muted-foreground mt-1 leading-5">
              Streak Breaker, Duo Breaker, Giant Killer, Payback and Rivalry award bounty points only.
              They never change Elo.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
