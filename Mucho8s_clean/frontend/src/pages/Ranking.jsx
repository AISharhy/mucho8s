import React, { useState } from "react";
import { Trophy, BarChart3, CalendarDays, Shield } from "lucide-react";
import Leaderboard from "@/pages/Leaderboard";
import Statistics from "@/pages/Statistics";
import SeasonHistory from "@/pages/SeasonHistory";
import RankGuide from "@/pages/RankGuide";

export default function Ranking({ initialTab = "leaderboard" }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="brand-kicker mb-1">Competition</div>
          <h2 className="font-display text-2xl font-extrabold">Ranking</h2>
          <p className="text-sm text-[#7F8795] mt-1">Leaderboard and performance analytics in one place.</p>
        </div>

        <div className="inline-flex w-full sm:w-auto rounded-xl border border-[#222834] bg-[#0F1218] p-1">
          <button
            type="button"
            onClick={() => setTab("leaderboard")}
            data-testid="ranking-tab-leaderboard"
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "leaderboard"
                ? "bg-white text-black"
                : "text-[#8D95A4] hover:text-white"
            }`}
          >
            <Trophy size={15} /> Leaderboard
          </button>
          <button
            type="button"
            onClick={() => setTab("statistics")}
            data-testid="ranking-tab-statistics"
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "statistics"
                ? "bg-white text-black"
                : "text-[#8D95A4] hover:text-white"
            }`}
          >
            <BarChart3 size={15} /> Statistics
          </button>
          <button
            type="button"
            onClick={() => setTab("ranks")}
            data-testid="ranking-tab-ranks"
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "ranks"
                ? "bg-white text-black"
                : "text-[#8D95A4] hover:text-white"
            }`}
          >
            <Shield size={15} /> Ranks
          </button>
          <button
            type="button"
            onClick={() => setTab("seasons")}
            data-testid="ranking-tab-seasons"
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "seasons"
                ? "bg-white text-black"
                : "text-[#8D95A4] hover:text-white"
            }`}
          >
            <CalendarDays size={15} /> Seasons
          </button>
          <button
            type="button"
            onClick={() => setTab("ranks")}
            data-testid="ranking-tab-ranks"
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === "ranks"
                ? "bg-white text-black"
                : "text-[#8D95A4] hover:text-white"
            }`}
          >
            <Shield size={15} /> Ranks
          </button>
        </div>
      </div>

      {tab === "leaderboard" ? (
        <Leaderboard />
      ) : tab === "statistics" ? (
        <Statistics />
      ) : tab === "seasons" ? (
        <SeasonHistory />
      ) : (
        <RankGuide />
      )}
    </div>
  );
}
