import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  Crown,
  LockKeyhole,
  Medal,
  Search,
  Trophy,
  UsersRound,
} from "lucide-react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { getSeasonAwards } from "@/lib/seasonAwards";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const rarityClass = {
  legendary: "border-[#D5A33A]/45 bg-[linear-gradient(145deg,rgba(213,163,58,.13),rgba(13,17,23,.96)_45%,rgba(255,42,59,.035))] shadow-[0_18px_50px_rgba(213,163,58,.07)]",
  epic: "border-[#9B67FF]/35 bg-[linear-gradient(145deg,rgba(145,70,255,.11),rgba(13,17,23,.96)_48%,rgba(84,168,255,.035))]",
  rare: "border-[#4F8BC9]/30 bg-[linear-gradient(145deg,rgba(79,139,201,.08),rgba(13,17,23,.97)_52%)]",
};

const rarityText = {
  legendary: "text-[#E9BD5A]",
  epic: "text-[#B68AFF]",
  rare: "text-[#7CB5E8]",
};

const archivePlayerLookup = (archives = []) => {
  const map = {};
  archives.forEach((season) => {
    (Array.isArray(season?.players) ? season.players : []).forEach((player) => {
      const id = String(player?.id || "");
      if (!id || map[id]) return;
      map[id] = player;
    });
  });
  return map;
};

const normalizeAwards = (archives = [], publicChallenges = []) =>
  archives.flatMap((season) =>
    getSeasonAwards(season, publicChallenges).map((award, index) => ({
      ...award,
      key: `${season.season_number}:${award.id || index}:${(award.playerIds || []).join("-")}`,
      seasonNumber: Number(award.seasonNumber ?? season.season_number ?? 0),
      seasonName: award.seasonName || season.season_name || `Season ${season.season_number}`,
      endedAt: season.ended_at || null,
      playerIds: Array.isArray(award.playerIds) ? award.playerIds.map(String) : [],
    }))
  );

const AwardCard = ({ award, playerLookup, playerAvatars, onOpen }) => {
  const players = award.playerIds.map((id) => playerLookup[id]).filter(Boolean);
  const rarity = String(award.rarity || "rare").toLowerCase();

  return (
    <button
      type="button"
      onClick={() => onOpen(award)}
      className={`group text-left rounded-[20px] border p-4 min-h-[250px] relative overflow-hidden transition-all hover:-translate-y-1 hover:border-white/20 ${rarityClass[rarity] || rarityClass.rare}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-50" />
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[9px] uppercase tracking-[0.17em] font-black ${rarityText[rarity] || rarityText.rare}`}>
          {rarity}
        </span>
        <span className="text-[9px] uppercase tracking-[0.15em] text-[#697181]">
          {award.seasonName}
        </span>
      </div>

      <div className="mt-6 flex items-center justify-center">
        <div className="w-20 h-20 rounded-[24px] border border-white/10 bg-black/20 flex items-center justify-center text-5xl shadow-[0_15px_45px_rgba(0,0,0,.35)] group-hover:scale-105 transition-transform">
          {award.emoji || "🏆"}
        </div>
      </div>

      <div className="mt-5 text-center">
        <div className="font-display text-lg font-black tracking-[-0.02em]">{award.title}</div>
        <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{award.detail}</div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 min-h-[34px]">
        {players.slice(0, 2).map((player) => (
          <div key={player.id} className="inline-flex items-center gap-1.5 rounded-full border border-[#2A303B] bg-black/20 pr-2">
            <PlayerAvatar
              name={player.name}
              elo={player.currentElo}
              size={28}
              avatarUrl={playerAvatars?.[player.id]}
            />
            <span className="text-[10px] font-bold max-w-[90px] truncate">{player.name}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-widest text-[#697181]">{award.category || "Award"}</span>
        <span className="font-mono text-xs font-black text-white">{award.value || "—"}</span>
      </div>
    </button>
  );
};

export default function HallOfFame() {
  const { competitionData, playerMap, playerAvatars, publicChallenges } = useData();
  const archives = Array.isArray(competitionData?.archives) ? competitionData.archives : [];
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedAward, setSelectedAward] = useState(null);
  const [selectedRecap, setSelectedRecap] = useState(null);

  const archivedPlayers = useMemo(() => archivePlayerLookup(archives), [archives]);
  const playerLookup = useMemo(
    () => ({ ...archivedPlayers, ...(playerMap || {}) }),
    [archivedPlayers, playerMap]
  );
  const awards = useMemo(() => normalizeAwards(archives, publicChallenges), [archives, publicChallenges]);

  const seasonRecaps = useMemo(() => archives.flatMap((season) => {
    const seasonPlayers = Array.isArray(season?.players) ? season.players : [];
    const seasonMatches = Array.isArray(season?.matches) ? season.matches : [];
    const seasonNumber = Number(season?.season_number || 0);
    return seasonPlayers
      .filter((player) => Number(player?.totalMatches || 0) > 0)
      .map((player) => {
        const id = String(player.id);
        const personalMatches = seasonMatches.filter((match) =>
          [...(match?.teamA || []), ...(match?.teamB || [])].map(String).includes(id)
        );
        let currentStreak = 0;
        let bestStreak = 0;
        const mapStats = new Map();
        const opponents = new Map();
        personalMatches
          .slice()
          .sort((a, b) => new Date(a?.date || 0) - new Date(b?.date || 0))
          .forEach((match) => {
            const onA = (match?.teamA || []).map(String).includes(id);
            const won = (onA && match?.winner === "A") || (!onA && match?.winner === "B");
            currentStreak = won ? currentStreak + 1 : 0;
            bestStreak = Math.max(bestStreak, currentStreak);
            const enemyIds = (onA ? match?.teamB : match?.teamA || []).map(String);
            enemyIds.forEach((enemyId) => {
              const row = opponents.get(enemyId) || { id: enemyId, games: 0, losses: 0 };
              row.games += 1;
              if (!won) row.losses += 1;
              opponents.set(enemyId, row);
            });
            (Array.isArray(match?.mapResults) ? match.mapResults : []).forEach((row) => {
              if (!row?.map || !["A", "B"].includes(row?.winner)) return;
              const stat = mapStats.get(row.map) || { map: row.map, wins: 0, losses: 0 };
              const mapWon = (onA && row.winner === "A") || (!onA && row.winner === "B");
              if (mapWon) stat.wins += 1; else stat.losses += 1;
              mapStats.set(row.map, stat);
            });
          });
        const bestMap = [...mapStats.values()]
          .filter((row) => row.wins + row.losses > 0)
          .sort((a, b) => (b.wins / (b.wins + b.losses)) - (a.wins / (a.wins + a.losses)) || (b.wins + b.losses) - (a.wins + a.losses))[0] || null;
        const nemesis = [...opponents.values()]
          .filter((row) => row.games >= 2)
          .sort((a, b) => b.losses - a.losses || b.games - a.games)[0] || null;
        return {
          key: `${seasonNumber}:${id}`,
          seasonNumber,
          seasonName: season?.season_name || `Season ${seasonNumber}`,
          player,
          wins: Number(player?.wins || personalMatches.filter((match) => {
            const onA = (match?.teamA || []).map(String).includes(id);
            return (onA && match?.winner === "A") || (!onA && match?.winner === "B");
          }).length),
          losses: Number(player?.losses || 0),
          finalElo: Math.round(Number(player?.currentElo || 0)),
          peakElo: Math.round(Number(player?.peakElo || player?.currentElo || 0)),
          bestStreak,
          mvp: Number(player?.mvpCount || 0),
          merda: Number(player?.merdaCount || 0),
          bestMap,
          nemesis,
        };
      });
  }), [archives]);

  const categories = useMemo(
    () => [...new Set(awards.map((award) => award.category).filter(Boolean))].sort(),
    [awards]
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return awards.filter((award) => {
      if (seasonFilter !== "all" && String(award.seasonNumber) !== seasonFilter) return false;
      if (categoryFilter !== "all" && String(award.category) !== categoryFilter) return false;
      if (!term) return true;
      const names = award.playerIds.map((id) => playerLookup[id]?.name || "").join(" ");
      return `${award.title} ${award.detail} ${names}`.toLowerCase().includes(term);
    });
  }, [awards, seasonFilter, categoryFilter, query, playerLookup]);

  const latestSeason = useMemo(
    () => [...archives].sort((a, b) => Number(b.season_number || 0) - Number(a.season_number || 0))[0] || null,
    [archives]
  );

  const legends = useMemo(() => {
    const totals = new Map();
    awards.forEach((award) => {
      award.playerIds.forEach((id) => {
        const row = totals.get(id) || { id, total: 0, legendary: 0, epic: 0, rare: 0 };
        row.total += 1;
        const rarity = String(award.rarity || "rare").toLowerCase();
        row[rarity] = Number(row[rarity] || 0) + 1;
        totals.set(id, row);
      });
    });
    return [...totals.values()]
      .sort((a, b) => b.total - a.total || b.legendary - a.legendary || b.epic - a.epic)
      .slice(0, 5);
  }, [awards]);

  const previewAwards = [
    ["🏆", "Season Champion", "Finish #1 in the final season standings", "Legendary"],
    ["👑", "Highest Peak", "Reach the highest Elo of the season", "Epic"],
    ["🔥", "Longest Win Streak", "Build the longest winning run", "Rare"],
    ["💰", "Money King", "Best verified money-match net result", "Epic"],
    ["🤝", "Best Chemistry", "Top-performing duo across the season", "Rare"],
    ["⚡", "Rivalry of the Season", "Most active head-to-head battle", "Epic"],
  ];

  return (
    <>
      <section className="m8-panel rounded-[22px] p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="brand-kicker mb-1">Permanent Collection</div>
            <h2 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.035em]">Hall of Fame</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Every season award becomes a permanent collectible card with the player who earned it.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 min-w-0 xl:min-w-[420px]">
            <div className="m8-stat-card">
              <Award size={14} className="text-[#D5A33A]" />
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-2">Cards</div>
              <div className="font-display text-xl font-black mt-0.5">{awards.length}</div>
            </div>
            <div className="m8-stat-card">
              <Crown size={14} className="text-[#B68AFF]" />
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-2">Legends</div>
              <div className="font-display text-xl font-black mt-0.5">{legends.length}</div>
            </div>
            <div className="m8-stat-card col-span-2 sm:col-span-1">
              <Medal size={14} className="text-[#7CB5E8]" />
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-2">Seasons</div>
              <div className="font-display text-xl font-black mt-0.5">{archives.length}</div>
            </div>
          </div>
        </div>
      </section>

      {legends.length > 0 && (
        <section className="m8-panel rounded-[22px] p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="brand-kicker mb-1">All-Time</div>
              <h3 className="font-display text-xl font-black">Legends</h3>
            </div>
            <Trophy size={18} className="text-[#D5A33A]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
            {legends.map((row, index) => {
              const player = playerLookup[row.id] || { id: row.id, name: "Player", currentElo: 500 };
              return (
                <Link
                  key={row.id}
                  to={playerMap?.[row.id] ? `/players/${row.id}` : "/bacheca/hall-of-fame"}
                  className="rounded-xl border border-[#222834] bg-[#0F1218] p-3 flex items-center gap-3 hover:border-[#3A424F]"
                >
                  <div className="font-mono text-[10px] font-black text-[#D5A33A]">#{index + 1}</div>
                  <PlayerAvatar
                    name={player.name}
                    elo={player.currentElo}
                    size={34}
                    avatarUrl={playerAvatars?.[row.id]}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black truncate">{player.name}</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      {row.total} cards · {row.legendary} legendary
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {seasonRecaps.length > 0 && (
        <section className="m8-panel rounded-[22px] p-4">
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <div className="brand-kicker mb-1">Season Recap</div>
              <h3 className="font-display text-xl font-black">Player season cards</h3>
            </div>
            <span className="text-[10px] text-muted-foreground">Permanent archive</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {seasonRecaps.slice().sort((a,b) => b.seasonNumber-a.seasonNumber || b.finalElo-a.finalElo).map((recap) => (
              <button key={recap.key} type="button" onClick={() => setSelectedRecap(recap)} className="shrink-0 w-[230px] rounded-[20px] border border-[#D5A33A]/25 bg-[linear-gradient(145deg,rgba(213,163,58,.10),rgba(13,17,23,.98)_55%)] p-4 text-left hover:border-[#D5A33A]/50 transition-all">
                <div className="text-[9px] uppercase tracking-[0.17em] text-[#D5A33A]">{recap.seasonName}</div>
                <div className="mt-4 flex items-center gap-3">
                  <PlayerAvatar name={recap.player.name} elo={recap.finalElo} size={46} avatarUrl={playerAvatars?.[recap.player.id]} />
                  <div className="min-w-0"><div className="font-display font-black truncate">{recap.player.name}</div><div className="font-mono text-[10px] text-muted-foreground">{recap.finalElo} Elo</div></div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-4 text-center">
                  <div className="rounded-lg bg-black/20 p-2"><div className="font-mono text-xs font-black">{recap.wins}-{recap.losses}</div><div className="text-[8px] text-muted-foreground">W-L</div></div>
                  <div className="rounded-lg bg-black/20 p-2"><div className="font-mono text-xs font-black">{recap.peakElo}</div><div className="text-[8px] text-muted-foreground">PEAK</div></div>
                  <div className="rounded-lg bg-black/20 p-2"><div className="font-mono text-xs font-black">W{recap.bestStreak}</div><div className="text-[8px] text-muted-foreground">STREAK</div></div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {awards.length > 0 ? (
        <>
          <section className="m8-panel rounded-[22px] p-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search player or trophy..."
                  className="h-10 pl-9 bg-[#0F1218] border-[#222834] rounded-xl"
                />
              </div>

              <select
                value={seasonFilter}
                onChange={(event) => setSeasonFilter(event.target.value)}
                className="h-10 rounded-xl bg-[#0F1218] border border-[#222834] px-3 text-xs font-semibold"
              >
                <option value="all">All seasons</option>
                {archives.map((season) => (
                  <option key={season.season_number} value={String(season.season_number)}>
                    {season.season_name || `Season ${season.season_number}`}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-10 rounded-xl bg-[#0F1218] border border-[#222834] px-3 text-xs font-semibold"
              >
                <option value="all">All categories</option>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between gap-3 mb-3 px-1">
              <div>
                <div className="brand-kicker mb-1">
                  {seasonFilter === "all" ? "All-Time Collection" : "Season Collection"}
                </div>
                <h3 className="font-display text-xl font-black">
                  {visible.length} Hall of Fame card{visible.length === 1 ? "" : "s"}
                </h3>
              </div>
              {latestSeason && (
                <span className="text-[10px] text-muted-foreground">
                  Latest archive · {latestSeason.season_name}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {visible.map((award) => (
                <AwardCard
                  key={award.key}
                  award={award}
                  playerLookup={playerLookup}
                  playerAvatars={playerAvatars}
                  onOpen={setSelectedAward}
                />
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="m8-panel rounded-[22px] p-5">
          <div className="max-w-2xl">
            <div className="w-12 h-12 rounded-2xl border border-[#D5A33A]/20 bg-[#D5A33A]/[0.06] flex items-center justify-center">
              <LockKeyhole size={20} className="text-[#D5A33A]" />
            </div>
            <h3 className="font-display text-2xl font-black mt-4">The first cards are still locked</h3>
            <p className="text-sm text-muted-foreground mt-2">
              No season has been archived yet. When the current season ends, award cards are generated automatically and placed here permanently.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 mt-5">
            {previewAwards.map(([emoji, title, detail, rarity]) => (
              <div key={title} className="rounded-xl border border-[#222834] bg-[#0F1218] p-3 flex items-center gap-3 opacity-75">
                <div className="w-10 h-10 rounded-xl bg-black/20 border border-[#2A303B] flex items-center justify-center text-xl">{emoji}</div>
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-widest text-[#697181]">{rarity}</div>
                  <div className="text-xs font-black mt-0.5">{title}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 truncate">{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={Boolean(selectedRecap)} onOpenChange={(open) => !open && setSelectedRecap(null)}>
        <DialogContent className="bg-[#090C11] border-[#D5A33A]/30 sm:max-w-2xl rounded-[28px] overflow-hidden">
          {selectedRecap && (
            <div className="relative">
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#D5A33A]">{selectedRecap.seasonName} · Season Recap</div>
                <div className="mt-5 flex justify-center"><PlayerAvatar name={selectedRecap.player.name} elo={selectedRecap.finalElo} size={84} avatarUrl={playerAvatars?.[selectedRecap.player.id]} /></div>
                <h2 className="font-display text-3xl font-black mt-3">{selectedRecap.player.name}</h2>
                <div className="font-mono text-sm text-[#D5A33A] mt-1">{selectedRecap.finalElo} FINAL ELO · {selectedRecap.peakElo} PEAK</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
                {[
                  ["Record", `${selectedRecap.wins}-${selectedRecap.losses}`],
                  ["Best Streak", `W${selectedRecap.bestStreak}`],
                  ["MVP", selectedRecap.mvp],
                  ["💩", selectedRecap.merda],
                  ["Best Map", selectedRecap.bestMap ? `${selectedRecap.bestMap.map} · ${Math.round(selectedRecap.bestMap.wins / (selectedRecap.bestMap.wins + selectedRecap.bestMap.losses) * 100)}%` : "—"],
                  ["Nemesis", selectedRecap.nemesis ? (playerLookup[selectedRecap.nemesis.id]?.name || "Player") : "—"],
                  ["Final Elo", selectedRecap.finalElo],
                  ["Peak Elo", selectedRecap.peakElo],
                ].map(([label,value]) => <div key={label} className="rounded-xl border border-[#222834] bg-[#0F1218] p-3 text-center"><div className="font-mono text-sm font-black">{value}</div><div className="text-[8px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div></div>)}
              </div>
              <div className="text-center text-[9px] uppercase tracking-[0.2em] text-[#697181] mt-6">Mucho · Hall of Fame</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedAward)} onOpenChange={(open) => !open && setSelectedAward(null)}>
        <DialogContent className="bg-[#0D1117] border-[#2A303B] sm:max-w-lg rounded-[24px] overflow-hidden">
          {selectedAward && (() => {
            const rarity = String(selectedAward.rarity || "rare").toLowerCase();
            const players = selectedAward.playerIds.map((id) => playerLookup[id]).filter(Boolean);
            return (
              <>
                <DialogHeader>
                  <div className="text-center pt-2">
                    <div className="text-6xl">{selectedAward.emoji || "🏆"}</div>
                    <div className={`mt-3 text-[9px] uppercase tracking-[0.18em] font-black ${rarityText[rarity] || rarityText.rare}`}>
                      {rarity} · {selectedAward.seasonName}
                    </div>
                    <DialogTitle className="font-display text-2xl font-black mt-1">
                      {selectedAward.title}
                    </DialogTitle>
                  </div>
                </DialogHeader>

                <div className="rounded-2xl border border-[#222834] bg-[#0F1218] p-4 text-center">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {players.map((player) => (
                      <div key={player.id} className="inline-flex items-center gap-2 rounded-full border border-[#2A303B] bg-[#12161D] pr-3">
                        <PlayerAvatar name={player.name} elo={player.currentElo} size={34} avatarUrl={playerAvatars?.[player.id]} />
                        <span className="text-xs font-black">{player.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="font-mono text-xl font-black mt-4">{selectedAward.value || "—"}</div>
                  <div className="text-xs text-muted-foreground mt-2">{selectedAward.detail}</div>
                </div>

                <div className="flex justify-center gap-2">
                  {players.map((player) => playerMap?.[player.id] ? (
                    <Link
                      key={player.id}
                      to={`/players/${player.id}`}
                      onClick={() => setSelectedAward(null)}
                      className="h-10 px-4 rounded-xl border border-[#2A303B] bg-[#151923] inline-flex items-center gap-2 text-xs font-bold"
                    >
                      <UsersRound size={14} />
                      {player.name}
                    </Link>
                  ) : null)}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
