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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="brand-kicker mb-1">Competition</div>
          <h2 className="font-display text-2xl font-extrabold">Ranking</h2>
          <p className="text-sm text-[#7F8795] mt-1">
            Overall standings, challenge ranking and season history.
          </p>
        </div>

        <div className="inline-flex w-full sm:w-auto rounded-xl border border-[#222834] bg-[#0F1218] p-1">
          <button
            type="button"
            onClick={() => setSection("ranking")}
            data-testid="ranking-section-ranking"
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
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              section === "seasons"
                ? "bg-white text-black"
                : "text-[#8D95A4] hover:text-white"
            }`}
          >
            <CalendarDays size={15} /> Seasons
          </button>
        </div>
      </div>

      {section === "seasons" ? (
        <SeasonHistory />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-1 border-b border-[#1D222C]">
            <button
              type="button"
              onClick={() => setRankingView("overall")}
              data-testid="ranking-view-overall"
              className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${
                rankingView === "overall"
                  ? "text-white"
                  : "text-[#7F8795] hover:text-white"
              }`}
            >
              Overall
              {rankingView === "overall" && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-magma" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setRankingView("challs")}
              data-testid="ranking-view-challs"
              className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${
                rankingView === "challs"
                  ? "text-white"
                  : "text-[#7F8795] hover:text-white"
              }`}
            >
              Challs
              {rankingView === "challs" && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-magma" />
              )}
            </button>
          </div>

          {rankingView === "challs" ? (
            <ChallengeLeaderboard />
          ) : (
            <div className="space-y-8">
              <Leaderboard />

              <section className="space-y-4">
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
