export function buildPlayerMapStats(matches, playerId) {
  const stats = new Map();
  for (const match of matches || []) {
    const onA = (match.teamA || []).includes(playerId);
    const onB = (match.teamB || []).includes(playerId);
    if (onA === onB) continue;
    for (const result of Array.isArray(match.mapResults) ? match.mapResults : []) {
      const map = String(result?.map || "").trim();
      if (!map || !["A", "B"].includes(result?.winner)) continue;
      const game = String(match.game || "Unknown game");
      const key = JSON.stringify([game, map]);
      const row = stats.get(key) || { key, game, map, wins: 0, losses: 0 };
      if (result.winner === (onA ? "A" : "B")) row.wins += 1;
      else row.losses += 1;
      stats.set(key, row);
    }
  }
  return [...stats.values()].map((row) => ({
    ...row, played: row.wins + row.losses,
    winRate: Math.round(row.wins / (row.wins + row.losses) * 100),
  })).sort((a, b) => b.played - a.played || b.winRate - a.winRate || a.map.localeCompare(b.map));
}
