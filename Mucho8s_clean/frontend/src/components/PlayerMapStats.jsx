import React, { useMemo, useState } from "react";
import { buildPlayerMapStats } from "@/lib/playerMapStats";
import MapPreviewCard from "@/components/MapPreviewCard";

export default function PlayerMapStats({ matches, playerId }) {
  const [game, setGame] = useState("all");
  const rows = useMemo(() => buildPlayerMapStats(matches, playerId), [matches, playerId]);
  const games = [...new Set(rows.map((row) => row.game))];
  const selectedGame = games.includes(game) ? game : "all";
  const visible = selectedGame === "all" ? rows : rows.filter((row) => row.game === selectedGame);
  const wins = visible.reduce((total, row) => total + row.wins, 0);
  const losses = visible.reduce((total, row) => total + row.losses, 0);
  return (
    <section className="m8-profile-compact-panel" style={{ gridColumn: "1 / -1" }} data-testid="profile-map-stats">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <div className="brand-kicker text-magma">Mucho8s</div>
          <h3 className="font-display font-black text-xl">Map Stats</h3>
        </div>
        {games.length > 1 && <select aria-label="Filter map stats by game" value={selectedGame} onChange={(event) => setGame(event.target.value)} className="rounded-lg border border-white/15 bg-[#10151D] px-3 py-2 text-sm">
          <option value="all">All games</option>
          {games.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>}
      </div>
      <p className="text-xs text-muted-foreground mb-4">Recorded map results only</p>
      {visible.length ? <>
        <div className="flex flex-wrap gap-4 text-sm font-bold mb-4">
          <span>{wins + losses} Maps played</span>
          <span className="text-emerald-400">{wins} Won</span>
          <span className="text-red-400">{losses} Lost</span>
          <span>{Math.round(wins / (wins + losses) * 100)}% Win rate</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((row, index) => <article key={row.key} className="rounded-xl border border-white/10 overflow-hidden bg-[#0D1118]">
            <MapPreviewCard mapName={row.map} game={row.game} mode={row.game} index={index} compact />
            <div className="p-3">
              <div className="flex justify-between text-xs mb-2"><span className="text-muted-foreground">{row.played} played</span><strong>{row.winRate}% WR</strong></div>
              <div className="flex gap-3 text-sm font-black"><span className="text-emerald-400">{row.wins} WON</span><span className="text-red-400">{row.losses} LOST</span></div>
              <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-red-500/60" aria-hidden="true"><div className="h-full bg-emerald-400" style={{ width: `${row.winRate}%` }} /></div>
            </div>
          </article>)}
        </div>
      </> : <p className="py-6 text-center text-sm text-muted-foreground">No recorded map results yet. Map stats appear when individual map winners are saved.</p>}
    </section>
  );
}
