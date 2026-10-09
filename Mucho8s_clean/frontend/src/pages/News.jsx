import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Newspaper,
  Sparkles,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { useData } from "@/context/DataContext";

const STATIC_NEWS = [
  {
    id: "preseason-live",
    date: "28 Sep 2026",
    category: "Competition",
    title: "Pre-Season is live",
    summary:
      "The current competitive period is now officially the MuchoMoney8s Pre-Season. Results remain active while we test and tune the platform before Season 1.",
    icon: Sparkles,
    accent: "#FF2A3B",
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
    accent: "#D5A33A",
  },
  {
    id: "dynamic-elo",
    date: "27 Sep 2026",
    category: "Ranking",
    title: "Dynamic Elo is now active",
    summary:
      "Elo gains and losses now depend on opponent strength. Upsets reward more Elo, while expected wins reward less. Team matches compare the average Elo of both teams.",
    icon: TrendingUp,
    accent: "#22C55E",
  },
];

const newsIcon = (category) => {
  const key = String(category || "").toLowerCase();
  if (key.includes("season") || key.includes("competition")) return Trophy;
  if (key.includes("rank") || key.includes("elo")) return TrendingUp;
  if (key.includes("update") || key.includes("platform")) return Sparkles;
  return Newspaper;
};

const formatNewsDate = (value) => {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function News() {
  const { competitionData, newsPosts, matches, playerMap } = useData();
  const [activeIndex, setActiveIndex] = useState(0);
  const current = competitionData?.current || {};

  const seasonLabel =
    current.season_name ||
    (Number(current.season_number) === 0
      ? "Pre-Season"
      : `Season ${current.season_number || 1}`);

  const NEWS = useMemo(() => {
    const dynamic = (Array.isArray(newsPosts) ? newsPosts : []).map((post) => ({
      id: post.id,
      date: formatNewsDate(post.created_at),
      category: post.category || "Platform",
      title: post.title,
      summary: post.summary,
      icon: newsIcon(post.category),
      accent: post.accent || "#FF2A3B",
      featured: Boolean(post.featured),
      dynamic: true,
    }));

    return dynamic.length ? dynamic : STATIC_NEWS;
  }, [newsPosts]);

  const communityFeed = useMemo(() => {
    const announcements = (Array.isArray(newsPosts) ? newsPosts : []).map((post) => ({
      id: `post-${post.id}`,
      type: "announcement",
      title: post.title,
      summary: post.summary,
      category: post.category || "Circle update",
      date: post.created_at,
    }));
    const results = (Array.isArray(matches) ? matches : []).map((match) => {
      const winner = String(match.winner || match.winnerTeam || "").toUpperCase();
      const teamA = (Array.isArray(match.teamA) ? match.teamA : []).map((id) => playerMap?.[id]?.name || id).join(", ");
      const teamB = (Array.isArray(match.teamB) ? match.teamB : []).map((id) => playerMap?.[id]?.name || id).join(", ");
      return {
        id: `match-${match.id}`,
        type: "match",
        category: "Verified match",
        title: `${teamA || "Team A"} vs ${teamB || "Team B"}`,
        summary: [match.game, match.mode, winner && `Winner: Team ${winner}`].filter(Boolean).join(" · "),
        date: match.date || match.created_at,
      };
    });
    return [...announcements, ...results]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 30);
  }, [newsPosts, matches, playerMap]);

  const activePost = NEWS[activeIndex] || NEWS[0];
  const ActiveIcon = activePost.icon;

  useEffect(() => {
    if (!NEWS.length) return undefined;
    if (activeIndex >= NEWS.length) setActiveIndex(0);
    const timer = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % NEWS.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [NEWS.length, activeIndex]);

  const changeSlide = (direction) => {
    setActiveIndex((currentIndex) => {
      const next = currentIndex + direction;
      if (next < 0) return NEWS.length - 1;
      if (next >= NEWS.length) return 0;
      return next;
    });
  };

  return (
    <div className="m8-page-stack max-w-6xl mx-auto">
      <section className="m8-panel rounded-[24px] p-5 sm:p-7" aria-label="Community feed">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <div className="brand-kicker mb-1">Circle Mucho8s</div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight">Hub</h1>
            <p className="text-sm text-muted-foreground mt-2">Community feed · Verified matches, player activity and Circle updates.</p>
          </div>
          <Newspaper size={25} className="text-magma shrink-0" />
        </div>
        <div className="space-y-3">
          {communityFeed.length === 0 ? (
            <div className="rounded-2xl border border-[#252B36] p-6 text-sm text-muted-foreground">
              No community activity yet. Verified match results and Circle announcements will appear here.
            </div>
          ) : communityFeed.map((item) => (
            <article key={item.id} className="rounded-2xl border border-[#252B36] bg-[#11161F] p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-[#D5A33A]">
                <span>{item.category}</span>
                <span className="text-muted-foreground">{item.date ? formatNewsDate(item.date) : ""}</span>
              </div>
              <h2 className="font-display text-lg font-bold mt-2">{item.title}</h2>
              <p className="text-sm text-muted-foreground mt-2">{item.summary}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="m8-news-ticker" aria-label="Latest updates">
        <div className="m8-news-live-label">
          <span className="m8-live-dot" />
          LIVE NEWS
        </div>

        <div className="m8-news-ticker-window">
          <div className="m8-news-ticker-track">
            {[0, 1].map((copy) => (
              <div className="m8-news-ticker-group" key={copy}>
                {NEWS.map((post) => (
                  <div className="m8-news-ticker-item" key={`${copy}-${post.id}`}>
                    <span style={{ color: post.accent }}>{post.category}</span>
                    <strong>{post.title}</strong>
                    <span className="m8-news-ticker-separator">•</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="m8-hero m8-news-hero rounded-[24px] p-6 sm:p-8 relative overflow-hidden">
        <span className="m8-hero-accent" />
        <span className="m8-news-orb m8-news-orb-one" />
        <span className="m8-news-orb m8-news-orb-two" />
        <span className="m8-news-scanline" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <div className="brand-kicker mb-2">MuchoMoney8s</div>
            <div className="flex items-center gap-3">
              <Newspaper size={25} className="text-magma m8-news-title-icon" />
              <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">
                Platform Updates
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
              Official announcements, competitive changes and platform updates from the Circle.
            </p>
          </div>

          <div className="m8-panel-quiet m8-news-current rounded-2xl px-4 py-3 min-w-[190px]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Current competition
            </div>
            <div className="font-display font-black text-lg mt-1">{seasonLabel}</div>
            <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="m8-news-pulse-dot" />
              Season 1 · 1 October 2026
            </div>
          </div>
        </div>
      </section>

      <section
        className="m8-news-feature rounded-[24px] overflow-hidden"
        style={{ "--news-accent": activePost.accent }}
      >
        <div className="m8-news-feature-glow" />
        <div className="m8-news-feature-grid" />

        <div className="relative z-10 grid lg:grid-cols-[1fr_auto] gap-6 p-5 sm:p-7">
          <div key={activePost.id} className="m8-news-slide-enter">
            <div className="flex items-center gap-3">
              <div className="m8-news-feature-icon">
                <ActiveIcon size={22} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: activePost.accent }}>
                  {activePost.category} · {activePost.date}
                </div>
                <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground mt-1">
                  Featured update
                </div>
              </div>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.035em] mt-5">
              {activePost.title}
            </h2>
            <p className="text-sm text-muted-foreground leading-6 mt-3 max-w-3xl">
              {activePost.summary}
            </p>

            <div className="flex items-center gap-2 mt-5 text-xs font-semibold">
              Latest platform update
              <ArrowRight size={14} className="m8-news-arrow" />
            </div>
          </div>

          <div className="flex lg:flex-col items-center justify-between lg:justify-center gap-3">
            <button
              type="button"
              onClick={() => changeSlide(-1)}
              className="m8-news-nav-btn"
              aria-label="Previous news"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex lg:flex-col gap-2">
              {NEWS.map((post, index) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`m8-news-dot ${index === activeIndex ? "is-active" : ""}`}
                  style={{ "--dot-accent": post.accent }}
                  aria-label={`Show ${post.title}`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => changeSlide(1)}
              className="m8-news-nav-btn"
              aria-label="Next news"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="m8-news-progress" key={`progress-${activeIndex}`}>
          <span />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_.65fr] gap-4">
        <div className="space-y-4">
          {NEWS.map((post, index) => {
            const Icon = post.icon;
            return (
              <article
                key={post.id}
                className="m8-panel m8-news-card rounded-2xl p-5 sm:p-6 relative overflow-hidden"
                style={{
                  "--news-card-accent": post.accent,
                  "--news-card-delay": `${index * 85}ms`,
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <div className="m8-news-card-shine" />
                <div className="flex items-start gap-4 pr-6">
                  <div className="m8-news-card-icon">
                    <Icon size={19} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      <span style={{ color: post.accent }}>{post.category}</span>
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

        <aside className="m8-panel m8-news-calendar rounded-2xl p-5 h-fit">
          <div className="flex items-center gap-2">
            <CalendarDays size={17} className="text-[#D5A33A]" />
            <h3 className="font-display font-black text-lg">Season calendar</h3>
          </div>

          <div className="m8-news-timeline mt-5">
            <div className="m8-news-timeline-row is-current">
              <span className="m8-news-timeline-node" />
              <div className="m8-panel-quiet rounded-xl p-3 flex-1">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Now</div>
                <div className="font-bold mt-1">Pre-Season</div>
                <div className="text-xs text-muted-foreground mt-1">Testing · balancing · tuning</div>
              </div>
            </div>

            <div className="m8-news-timeline-row is-next">
              <span className="m8-news-timeline-node" />
              <div className="m8-panel-quiet rounded-xl p-3 border-emerald-500/15 flex-1">
                <div className="text-[10px] uppercase tracking-widest text-emerald-400">Next</div>
                <div className="font-bold mt-1">Season 1</div>
                <div className="text-xs text-muted-foreground mt-1">Starts 1 October 2026 · 500 Elo</div>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed pt-4">
            After Season 1, a new season starts automatically on the first day of every month.
          </p>
        </aside>
      </div>
    </div>
  );
}
