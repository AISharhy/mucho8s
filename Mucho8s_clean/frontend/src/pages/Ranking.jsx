import React, { useEffect, useState } from "react";
import { CalendarDays, Trophy } from "lucide-react";
import Leaderboard from "@/pages/Leaderboard";
import Statistics from "@/pages/Statistics";
import SeasonHistory from "@/pages/SeasonHistory";

const normalizeInitial = (initialTab) =>
  initialTab === "seasons" ? "seasons" : "ranking";

export default function Ranking({ initialTab = "leaderboard" }) {
  const [section, setSection] = useState(normalizeInitial(initialTab));

  useEffect(() => {
    setSection(normalizeInitial(initialTab));
  }, [initialTab]);

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="brand-kicker mb-1">Competition</div>
          <h2 className="font-display text-3xl font-black tracking-[-0.03em]">Leaderboard</h2>
          <p className="text-sm text-[#7F8795] mt-1">
            One ranking for matches and Money Challs, with season history in one place.
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
            <Trophy size={15} /> Leaderboard
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
        <div className="space-y-8">
          <Leaderboard />

          <section className="m8-panel rounded-2xl p-5 sm:p-6 space-y-4">
            <div>
              <div className="brand-kicker mb-1">Performance</div>
              <h3 className="font-display text-xl font-bold">Statistics</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Match activity, progression and competitive performance.
              </p>
            </div>
            <Statistics />
          </section>
        </div>
      )}
    </div>
  );
}
