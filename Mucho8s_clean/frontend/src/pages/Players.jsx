import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge, RankBadge, RankProgress, Last10, StreakBadge, WinRatePill, MvpBadge } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ProductState";
import { Search, Flame, ArrowUpRight, Users } from "lucide-react";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "hot", label: "On Fire" },
  { key: "masters", label: "Masters" },
  { key: "veteran", label: "Veterans" },
];

export default function Players() {
  const { players, playerAvatars } = useData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const list = useMemo(() => {
    let result = players.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    if (filter === "hot") result = result.filter((p) => p.currentStreak >= 2);
    if (filter === "masters") result = result.filter((p) => p.currentElo >= 1350);
    if (filter === "veteran") result = result.filter((p) => p.totalMatches >= 50);
    return [...result].sort((a, b) => b.currentElo - a.currentElo);
  }, [players, query, filter]);

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="brand-kicker mb-1">Roster</div>
          <div className="flex items-center gap-2">
            <Users size={19} className="text-magma" />
            <h2 className="font-display text-3xl font-black tracking-[-0.03em]">Players</h2>
          </div>
          <p className="text-sm text-[#7F8795] mt-1">{players.length} players in the active ladder.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 lg:items-center">
          <div className="relative w-full sm:w-72">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#697181]" />
            <Input
              data-testid="players-search-input"
              placeholder="Search players..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 bg-[#0F1218] border-[#222834] h-11 rounded-xl"
            />
          </div>

          <div className="inline-flex flex-wrap gap-1.5">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                data-testid={`players-filter-${item.key}`}
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  filter === item.key
                    ? "bg-magma text-white border-magma"
                    : "bg-[#0F1218] text-[#8D95A4] hover:text-white border-[#222834]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4" data-testid="players-grid">
        {list.map((p) => (
          <Link
            key={p.id}
            to={`/players/${p.id}`}
            data-testid={`player-card-${p.id}`}
            className="m8-panel rounded-2xl p-5 text-left animate-fade-up block group hover:-translate-y-0.5 transition-transform duration-200"
          >
            <div className="flex items-center gap-3 mb-5">
              <PlayerAvatar name={p.name} elo={p.currentElo} size={46} avatarUrl={playerAvatars[p.id]} />
              <div className="min-w-0 flex-1">
                <div className="font-display font-bold text-[17px] truncate flex items-center gap-1.5">
                  {p.name}
                  {p.currentStreak >= 3 && <Flame size={14} className="text-magma" />}
                </div>
                <div className="mt-1"><RankBadge elo={p.currentElo} compact /></div>
              </div>
              <ArrowUpRight size={16} className="text-[#596170] group-hover:text-magma transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div>
                <div className="brand-kicker mb-1">Current</div>
                <EloBadge elo={p.currentElo} />
              </div>
              <div>
                <div className="brand-kicker mb-1">Peak</div>
                <span className="font-mono font-bold text-white">{p.peakElo}</span>
              </div>
              <div>
                <div className="brand-kicker mb-1">Win Rate</div>
                <WinRatePill player={p} />
              </div>
              <div>
                <div className="brand-kicker mb-1">MVP</div>
                <MvpBadge count={p.mvpCount} />
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[#1D222C]">
              <RankProgress elo={p.currentElo} compact />
              <div className="flex items-center justify-between mt-3">
                <Last10 record={p.last10} />
                <StreakBadge streak={p.currentStreak} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {list.length === 0 && (
        <EmptyState
          icon={Users}
          title={players.length === 0 ? "No players yet" : "No players match these filters"}
          description={players.length === 0
            ? "The competitive ladder is ready. Players will appear here as soon as they are added."
            : "Try a different name or remove one of the active filters."}
        />
      )}
    </div>
  );
}
