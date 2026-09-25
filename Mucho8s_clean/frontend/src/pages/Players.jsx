import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge, TierTag, Last10, StreakBadge, WinRatePill, MvpBadge } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Search, Flame, ArrowUpRight } from "lucide-react";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "hot", label: "On Fire" },
  { key: "legend", label: "Legends" },
  { key: "veteran", label: "Veterans" },
];

export default function Players() {
  const { players } = useData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const list = useMemo(() => {
    let result = players.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    if (filter === "hot") result = result.filter((p) => p.currentStreak >= 2);
    if (filter === "legend") result = result.filter((p) => p.currentElo >= 1500);
    if (filter === "veteran") result = result.filter((p) => p.totalMatches >= 50);
    return [...result].sort((a, b) => b.currentElo - a.currentElo);
  }, [players, query, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="players-search-input"
            placeholder="Search players..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 bg-[#161924] border-[#242938] h-11"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              data-testid={`players-filter-${item.key}`}
              onClick={() => setFilter(item.key)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                filter === item.key
                  ? "bg-magma text-white"
                  : "bg-[#161924] text-muted-foreground hover:text-white border border-[#242938]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="players-grid">
        {list.map((p) => (
          <Link
            key={p.id}
            to={`/players/${p.id}`}
            data-testid={`player-card-${p.id}`}
            className="card-surface rounded-xl p-5 text-left animate-fade-up block group"
          >
            <div className="flex items-center gap-3 mb-4">
              <PlayerAvatar name={p.name} elo={p.currentElo} size={48} />
              <div className="min-w-0 flex-1">
                <div className="font-display font-bold text-lg truncate flex items-center gap-1.5">
                  {p.name}
                  {p.currentStreak >= 3 && <Flame size={15} className="text-magma" />}
                </div>
                <TierTag elo={p.currentElo} />
              </div>
              <ArrowUpRight size={16} className="text-muted-foreground group-hover:text-magma transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Current</div>
                <EloBadge elo={p.currentElo} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Peak</div>
                <span className="font-mono font-bold text-gold">{p.peakElo}</span>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Win Rate</div>
                <WinRatePill player={p} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">MVPs</div>
                <MvpBadge count={p.mvpCount} />
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#242938]">
              <Last10 record={p.last10} />
              <StreakBadge streak={p.currentStreak} />
            </div>
          </Link>
        ))}
      </div>

      {list.length === 0 && (
        <div className="text-center text-muted-foreground py-16">No players found.</div>
      )}
    </div>
  );
}
