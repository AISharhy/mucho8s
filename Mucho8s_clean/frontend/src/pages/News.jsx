import React from "react";
import { CalendarDays, Newspaper, Sparkles, Trophy, TrendingUp } from "lucide-react";
import { useData } from "@/context/DataContext";

const NEWS = [
  {
    id: "preseason-live",
    date: "28 Sep 2026",
    category: "Competition",
    title: "Pre-Season is live",
    summary:
      "The current competitive period is now officially the MuchoMoney8s Pre-Season. Results remain active while we test and tune the platform before Season 1.",
    icon: Sparkles,
    featured: true,
  },
  {
    id: "season-one",
    date: "1 Oct 2026",
    category: "Season",
    title: "Season 1 starts October 1",
    summary:
      "Season 1 begins on the first day of October. Every player starts the official season at 500 Elo in Iron. Seasons then roll over automatically on the first day of every month.",
    icon: Trophy,
  },
  {
    id: "dynamic-elo",
    date: "27 Sep 2026",
    category: "Ranking",
    title: "Dynamic Elo is now active",
    summary:
      "Elo gains and losses now depend on opponent strength. Upsets reward more Elo, while expected wins reward less. Team matches compare the average Elo of both teams.",
    icon: TrendingUp,
  },
];

export default function News() {
  const { competitionData } = useData();
  const current = competitionData?.current || {};
  const seasonLabel =
    current.season_name ||
    (Number(current.season_number) === 0
      ? "Pre-Season"
      : `Season ${current.season_number || 1}`);

  return (
    <div className="m8-page-stack max-w-6xl mx-auto">
      <section className="m8-hero rounded-[24px] p-6 sm:p-8 relative overflow-hidden">
        <span className="m8-hero-accent" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <div className="brand-kicker mb-2">MuchoMoney8s</div>
            <div className="flex items-center gap-3">
              <Newspaper size={25} className="text-magma" />
              <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">
                News & Updates
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
              Season announcements, competitive changes and important platform updates.
            </p>
          </div>

          <div className="m8-panel-quiet rounded-2xl px-4 py-3 min-w-[190px]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Current competition
            </div>
            <div className="font-display font-black text-lg mt-1">{seasonLabel}</div>
            <div className="text-xs text-emerald-400 mt-1">
              Season 1 · 1 October 2026
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_.65fr] gap-4">
        <div className="space-y-4">
          {NEWS.map((post) => {
            const Icon = post.icon;
            return (
              <article
                key={post.id}
                className={`m8-panel rounded-2xl p-5 sm:p-6 relative overflow-hidden ${
                  post.featured ? "border-magma/25" : ""
                }`}
              >
                {post.featured && (
                  <div className="absolute right-4 top-4 text-[9px] uppercase tracking-[0.18em] font-black text-magma">
                    Featured
                  </div>
                )}

                <div className="flex items-start gap-4 pr-16">
                  <div className="w-11 h-11 rounded-xl bg-white/[0.035] border border-[#2B3340] flex items-center justify-center shrink-0">
                    <Icon size={19} className={post.featured ? "text-magma" : "text-[#C7CFDA]"} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      <span>{post.category}</span>
                      <span>·</span>
                      <span>{post.date}</span>
                    </div>
                    <h2 className="font-display text-xl sm:text-2xl font-black mt-2 tracking-[-0.025em]">
                      {post.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                      {post.summary}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="m8-panel rounded-2xl p-5 h-fit">
          <div className="flex items-center gap-2">
            <CalendarDays size={17} className="text-[#D5A33A]" />
            <h3 className="font-display font-black text-lg">Season calendar</h3>
          </div>
          <div className="mt-4 space-y-3">
            <div className="m8-panel-quiet rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Now</div>
              <div className="font-bold mt-1">Pre-Season</div>
              <div className="text-xs text-muted-foreground mt-1">Testing · balancing · tuning</div>
            </div>
            <div className="m8-panel-quiet rounded-xl p-3 border-emerald-500/15">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400">Next</div>
              <div className="font-bold mt-1">Season 1</div>
              <div className="text-xs text-muted-foreground mt-1">Starts 1 October 2026 · 500 Elo</div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pt-1">
              After Season 1, a new season starts automatically on the first day of every month.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
