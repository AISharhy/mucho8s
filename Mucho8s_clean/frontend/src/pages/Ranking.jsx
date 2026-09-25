import React, { useState } from "react";
import { Trophy, BarChart3 } from "lucide-react";
import Leaderboard from "@/pages/Leaderboard";
import Statistics from "@/pages/Statistics";

export default function Ranking({ initialTab = "leaderboard" }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="space-y-6">
      <div className="inline-flex w-full sm:w-auto rounded-lg border border-[#242938] bg-[#101219] p-1">
        <button
          type="button"
          onClick={() => setTab("leaderboard")}
          data-testid="ranking-tab-leaderboard"
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
            tab === "leaderboard"
              ? "bg-magma text-white"
              : "text-muted-foreground hover:text-white hover:bg-white/5"
          }`}
        >
          <Trophy size={16} /> Leaderboard
        </button>
        <button
          type="button"
          onClick={() => setTab("statistics")}
          data-testid="ranking-tab-statistics"
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
            tab === "statistics"
              ? "bg-magma text-white"
              : "text-muted-foreground hover:text-white hover:bg-white/5"
          }`}
        >
          <BarChart3 size={16} /> Statistics
        </button>
      </div>

      {tab === "leaderboard" ? <Leaderboard /> : <Statistics />}
    </div>
  );
}
