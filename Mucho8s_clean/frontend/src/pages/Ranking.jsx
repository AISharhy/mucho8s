import React, { useEffect, useState } from "react";
import { CalendarDays, Trophy } from "lucide-react";
import Leaderboard from "@/pages/Leaderboard";
import Statistics from "@/pages/Statistics";
import SeasonHistory from "@/pages/SeasonHistory";
import ChallengeLeaderboard from "@/pages/ChallengeLeaderboard";

const normalizeInitial = (initialTab) => {
  if (initialTab === "seasons") return { section: "seasons", rankingView: "overall" };
  if (initialTab === "challenges") return { section: "ranking", rankingView: "challs" };
  return { section: "ranking", rankingView: "overall" };
};

export default function Ranking({ initialTab = "leaderboard" }) {
  const initial = normalizeInitial(initialTab);
  const [section, setSection] = useState(initial.section);
  const [rankingView, setRankingView] = useState(initial.rankingView);

  useEffect(() => {
    const next = normalizeInitial(initialTab);
    setSection(next.section);
    setRankingView(next.rankingView);
  }, [initialTab]);

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="brand-kicker mb-1">Competition</div>
          <h2 className="font-display text-3xl font-black tracking-[-0.03em]">Ranking</h2>
          <p className="text-sm text-[#7F8795] mt-1">
            Overall standings, challenge ranking and season history.
          </p>
        </div>

        <div className="inline-flex w-full sm:w-auto rounded-xl border border-[#222834] bg-[#0F1218] p-1">
          <button
            type="button"
            onClick={() => setSection("ranking")}
            data-testid="ranking-section-ranking"
            aria-pressed={section === "ranking"}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              section === "ranking"
                ? "bg-white text-black"
                : "text-[#8D95A4] hover:text-white"
            }`}
          >
            <Trophy size={15} /> Ranking
          </button>

          <button
            type="button"
            onClick={() => setSection("seasons")}
            data-testid="ranking-section-seasons"
            aria-pressed={section === "seasons"}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              section === "seasons"
                ? "bg-white text-black"
                : "text-[#8D95A4] hover:text-white"
            }`}
          >
            <CalendarDays size={15} /> Seasons
          </button>
        </div>
      </section>

      {section === "seasons" ? (
        <SeasonHistory />
      ) : (
        <div className="space-y-6">
          <div className="m8-panel-quiet rounded-xl p-1 inline-flex items-center gap-1 self-start">
            <button
              type="button"
              onClick={() => setRankingView("overall")}
              data-testid="ranking-view-overall"
              aria-pressed={rankingView === "overall"}
              className={`relative px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                rankingView === "overall"
                  ? "bg-white text-black"
                  : "text-[#7F8795] hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              Overall
            </button>

            <button
              type="button"
              onClick={() => setRankingView("challs")}
              data-testid="ranking-view-challs"
              aria-pressed={rankingView === "challs"}
              className={`relative px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                rankingView === "challs"
                  ? "bg-white text-black"
                  : "text-[#7F8795] hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              Challs
            </button>
          </div>

          {rankingView === "challs" ? (
            <ChallengeLeaderboard />
          ) : (
            <div className="space-y-8">
              <Leaderboard />

              <section className="m8-panel rounded-2xl p-5 sm:p-6 space-y-4">
                <div>
                  <div className="brand-kicker mb-1">Performance</div>
                  <h3 className="font-display text-xl font-bold">Statistics</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Elo progression, win rates, activity and competitive performance.
                  </p>
                </div>
                <Statistics />
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
